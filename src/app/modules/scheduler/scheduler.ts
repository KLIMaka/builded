import { delayed, value } from "@utils/callbacks";
import { Consumer, Function } from "@utils/types";
import Optional from "optional-js";
import { EventLoop, ProgressInfo, Scheduler, Task, TaskController, TaskHandle, TaskInerruptedError, TaskResult } from "../../apis/app1";

class Barrier {
  private promise: Promise<void>;
  private ok: Consumer<void> | undefined;
  private err: Consumer<Error> | undefined;

  constructor(private blocked = true) {
    this.promise = this.updatePromise();
  }

  private updatePromise() {
    return this.blocked
      ? new Promise<void>((ok, err) => [this.ok, this.err] = [ok, err])
      : Promise.resolve();
  }

  wait(): Promise<void> { return this.promise }
  block() { if (this.blocked) return; this.blocked = true; this.promise = this.updatePromise(); }
  unblock() { if (!this.blocked) return; this.blocked = false; this.ok?.(); this.promise = this.updatePromise(); }
  error(err: Error) { if (!this.blocked) return; this.err?.(err) }
  isBlocking() { return this.blocked }
}

class PropgressInfoImpl implements ProgressInfo {
  readonly info = value('');
  readonly progress = value(0);

  private rest(): number {
    return 100 - this.progress.get();
  }

  percents(percents: number, count = 1): number {
    return (this.rest() * (percents / 100)) / count;
  }

  inc(dp: number): void {
    this.progress.mod(p => p + dp);
  }
}

class TaskDescriptor<T> implements TaskController<T>, TaskHandle {
  private stopped = false;
  private pauseBarrier = new Barrier(false);
  private task: Promise<TaskResult<T>>;
  private progressImpl = new PropgressInfoImpl();

  readonly paused = value(false);
  readonly result = value<Optional<TaskResult<T>>>(Optional.empty());
  readonly info = delayed(this.progressImpl.info, 16, () => performance.now());
  readonly progress = delayed(this.progressImpl.progress, 16, () => performance.now());


  constructor(private scheduler: SchedulerImpl) { }

  async wait(info: string, dp: number): Promise<void> {
    if (this.stopped) throw new TaskInerruptedError();
    this.progressImpl.info.set(info);
    await this.scheduler.wait();
    await this.pauseBarrier.wait();
    this.progressImpl.progress.mod(p => p + dp);
  }

  async waitFor<T>(promise: Promise<T>, info: string, dp: number): Promise<T> {
    if (this.stopped) throw new TaskInerruptedError();
    this.progressImpl.info.set(info);
    const result = await promise;
    await this.scheduler.wait();
    await this.pauseBarrier.wait();
    this.progressImpl.progress.mod(p => p + dp);
    return result;
  }

  async waitForParallel<T>(items: T[], mapper: Function<T, Promise<void>>, doneInfo: Function<T, string>, progress = 100): Promise<void> {
    if (this.stopped) throw new TaskInerruptedError();
    const dp = this.progressImpl.percents(progress, items.length);
    const promises = items.map(i => mapper(i).then(_ => { this.progressImpl.info.set(doneInfo(i)); this.progressImpl.progress.mod(p => p + dp) }));
    await Promise.all(promises);
    await this.scheduler.wait();
    await this.pauseBarrier.wait();
  }

  pause() { this.paused.set(true); this.pauseBarrier.block() }
  unpause() { this.paused.set(false); this.pauseBarrier.unblock() }
  setTask(task: Promise<TaskResult<T>>) { this.task = task }
  end() { return this.task }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.paused.get()) this.pauseBarrier.error(new TaskInerruptedError());
    await this.task;
  }
}

export class SchedulerImpl implements Scheduler {
  private nextTick: Promise<void>;

  constructor(private eventloop: EventLoop) {
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
    const descriptor = new TaskDescriptor<T>(this);
    const wrappedTask = task(descriptor)
      .then(result => { const ok: TaskResult<T> = { type: "done", result }; descriptor.result.set(Optional.of(ok)); return ok })
      .catch(error => { const err: TaskResult<T> = { type: "error", error }; descriptor.result.set(Optional.of(err)); return err })
    descriptor.setTask(wrappedTask);
    return descriptor;
  }

  wait(): Promise<void> { return this.nextTick }
}

export function DefaultScheduler(eventloop: EventLoop): Scheduler {
  return new SchedulerImpl(eventloop);
}