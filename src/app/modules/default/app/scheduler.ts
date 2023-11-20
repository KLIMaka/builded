export type Callback<T> = (arg: T) => void;
export type EventLoop = (cb: Callback<void>) => void;

export interface TaskHandle {
  wait(): Promise<void>;
  waitFor<T>(promise: Promise<T>): Promise<T>;
}

export interface TaskController {
  pause(): void;
  unpause(): void;
  stop(): void,
}

export type Task = (handle: TaskHandle) => Promise<void>;

export interface Scheduler {
  exec(task: Task): TaskController;
}

class TaskInerruptedError extends Error {
  constructor() {
    super('Task Interrupted');
  }
};

class Barrier {
  private promise: Promise<void>;
  private ok: Callback<void> | undefined;
  private err: Callback<Error> | undefined;

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

class TaskDescriptor implements TaskController, TaskHandle {
  private paused = false;
  private stopped = false;
  private pauseBarrier = new Barrier(false);

  constructor(private scheduler: SchedulerImpl) { }

  async wait(): Promise<void> {
    if (this.stopped) throw new TaskInerruptedError();
    await this.scheduler.wait();
    await this.pauseBarrier.wait()
  }

  async waitFor<T>(promise: Promise<T>): Promise<T> {
    if (this.stopped) throw new TaskInerruptedError();
    const result = await promise;
    await this.scheduler.wait();
    await this.pauseBarrier.wait();
    return result;
  }

  pause() { this.pauseBarrier.block() }
  unpause() { this.pauseBarrier.unblock() }

  stop() {
    this.stopped = true;
    if (this.paused) this.pauseBarrier.error(new TaskInerruptedError());
  }
}

export class SchedulerImpl implements Scheduler {
  private nextTick: Promise<void>;

  constructor(private eventloop: EventLoop) {
    this.nextTick = this.createNextTick();
  }

  private createNextTick() {
    return new Promise<void>(ok => this.eventloop(() => this.run(ok)));
  }

  private run(cb: Callback<void>) {
    cb();
    this.nextTick = this.createNextTick();
  }

  exec(task: Task): TaskController {
    const descriptor = new TaskDescriptor(this);
    task(descriptor)
      .then(() => console.log('end'))
      .catch(e => console.error(e))
      .finally(() => console.log('finished'));
    return descriptor;
  }

  wait(): Promise<void> { return this.nextTick }
}

export function DefaultScheduler(eventloop: EventLoop): Scheduler {
  return new SchedulerImpl(eventloop);
}