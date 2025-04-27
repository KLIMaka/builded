import { transformedBuilder, tuple, value } from "@utils/callbacks";
import { Consumer, Err, Ok, Result, second, Supplier } from "@utils/types";
import { done, EventLoop, Logger, progress, ProgressInfo, Scheduler, Task, TaskController, TaskHandle, TaskInerruptedError, Timer } from "../../apis/app1";

const RESOLVED = Promise.resolve();

class Barrier {
  private promise = RESOLVED;
  private ok: Consumer<void>;
  private err: Consumer<Error>;

  constructor(private blocked = true) {
    if (blocked) this.createBarrier();
  }

  private createBarrier() {
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    this.promise = promise;
    this.ok = resolve;
    this.err = reject;
    this.blocked = true;
  }

  private releaseBarrier() {
    this.ok();
    this.promise = RESOLVED;
    this.blocked = false;
  }

  wait(): Promise<void> { return this.promise }
  block() { if (!this.blocked) this.createBarrier() }
  unblock() { if (this.blocked) this.releaseBarrier() }
  error(err: Error) { if (this.blocked) this.err(err) }
}

class PropgressInfoImpl implements ProgressInfo {
  private id = 0;
  private infos = value<[number, string][]>('', []);
  private planCount = value('', 0);
  private currentCount = value('', 0);
  readonly info = transformedBuilder({
    value: '',
    source: this.infos,
    transformer: is => is.map(second).toString()
  });
  readonly progress = transformedBuilder({
    value: 0,
    source: tuple(this.planCount, this.currentCount),
    transformer: ([plan, current]) => (plan === 0 ? 0 : current / plan) * 100
  });

  plan(dc: number) {
    this.planCount.mod(c => c + dc);
  }

  inc(dc: number) {
    this.currentCount.mod(c => c + dc);
  }

  beginTask(label: string): number {
    const id = this.id++;
    this.infos.mod(is => [...is, [id, label]]);
    return id;
  }

  endTask(id: number): void {
    this.infos.mod(is => is.filter(([itemId, _]) => id !== itemId));
  }
}

class TaskDescriptor<T> implements TaskController<T>, TaskHandle {
  private stopped = false;
  private pauseBarrier = new Barrier(false);
  private taskImpl: Promise<Result<T>>;
  private progressImpl = new PropgressInfoImpl();

  readonly paused = value('', false);
  readonly task = value('', progress<T>(this.progressImpl));
  readonly info = this.progressImpl.info;
  readonly progress = this.progressImpl.progress;

  constructor(
    private scheduler: Supplier<Promise<void>>,
    private timer: Timer
  ) { }

  private checkStopped() { if (this.stopped) throw new TaskInerruptedError() }

  plan(count: number): void {
    this.progressImpl.plan(count);
  }

  incProgress(inc: number): void {
    this.progressImpl.inc(inc);
  }

  async wait(info: string = '', count: number = 1): Promise<void> {
    this.checkStopped();
    this.progressImpl.info.set(info);
    await this.scheduler();
    await this.pauseBarrier.wait();
    this.checkStopped();
    this.progressImpl.inc(count);
  }

  async waitFor<T>(promise: Promise<T>, info: string = '', count: number = 1): Promise<T> {
    this.checkStopped();
    const infoId = this.progressImpl.beginTask(info);
    const result = await promise;
    this.progressImpl.endTask(infoId);
    this.progressImpl.inc(count);
    await this.pauseBarrier.wait();
    this.checkStopped();
    return result;
  }

  async waitForBatchTask(batch: Consumer<void>[], info?: string, time = 10): Promise<void> {
    this.checkStopped();
    const infoId = this.progressImpl.beginTask(info);
    this.plan(batch.length);
    let start = this.timer.now();
    for (const task of batch) {
      task();
      this.incProgress(1);

      if (this.timer.now() - start < time) continue;
      else {
        await this.scheduler();
        await this.pauseBarrier.wait();
        this.checkStopped();
        start = this.timer.now();
      }
    }
    await this.pauseBarrier.wait();
    this.checkStopped();
    this.progressImpl.endTask(infoId);
  }

  pause() { this.paused.set(true); this.pauseBarrier.block() }
  unpause() { this.paused.set(false); this.pauseBarrier.unblock() }
  setTask(task: Promise<Result<T>>) { this.taskImpl = task }
  end() { return this.taskImpl }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.paused.get()) this.pauseBarrier.error(new TaskInerruptedError());
    await this.taskImpl;
  }
}

export class SchedulerImpl implements Scheduler {
  private nextTick: Promise<void>;

  constructor(
    private eventloop: EventLoop,
    private timer: Timer,
    private logger: Logger
  ) {
    this.nextTick = this.createNextTick();
  }

  private createNextTick() {
    return new Promise<void>(ok => {
      const eventloop = this.eventloop;
      eventloop(() => this.run(ok));
    });
  }

  private run(cb: Consumer<void>) {
    cb();
    this.nextTick = this.createNextTick();
  }

  exec<T>(task: Task<T>): TaskController<T> {
    const descriptor = new TaskDescriptor<T>(() => this.nextTick, this.timer);
    const wrappedTask = task(descriptor)
      .then(result => { const ok = new Ok<T>(result); descriptor.task.set(done(ok)); return ok })
      .catch(error => { const err = new Err(error); descriptor.task.set(done(err)); this.logger.log("ERROR", error); return err })
    descriptor.setTask(wrappedTask);
    return descriptor;
  }

}

export function DefaultScheduler(eventloop: EventLoop, timer: Timer, logger: Logger): Scheduler {
  return new SchedulerImpl(eventloop, timer, logger);
}