import { Deck } from '../../utils/collections';
import { Injector } from '../../utils/injector';
import { iter } from '../../utils/iter';
import { PostFrame } from '../edit/messages';
import { ScheddulerHandler, Scheduler, SchedulerTask, TaskHandle } from './app';
import { BUS, Handle, MessageHandlerReflective } from './handler';

export const DefaultScheduler = (() => {
  let handle: Handle;
  return {
    start: async (injector: Injector) => {
      const bus = await injector.getInstance(BUS);
      const scheduler = new SchedulerImpl();
      bus.connect(scheduler);
      return scheduler;
    },
    stop: async (injector: Injector) => {
      const bus = await injector.getInstance(BUS);
      bus.disconnect(handle);
    },
  }
})();

class TaskHandleImpl implements TaskHandle {
  constructor(
    private stopped = false,
    public description = "",
    public progress = -1
  ) { }


  stop(): void { this.stopped = true }
  isStopped() { return this.stopped }
  getDescription(): string { return this.description }
  getProgress(): number { return this.progress }
  setDescription(s: string): void { this.description = s }
  setProgress(p: number): void { this.progress = p }
}

class SchedulerImpl extends MessageHandlerReflective implements Scheduler {
  private tasks = new Deck<[TaskHandleImpl, SchedulerTask]>();
  private nextTasks = new Deck<[TaskHandleImpl, SchedulerTask]>();
  private handlers: ScheddulerHandler[] = [];

  addTask(task: SchedulerTask) {
    const handle = new TaskHandleImpl();
    this.tasks.push([handle, task]);
    this.handleAdd(handle);
    return handle;
  }

  addHandler(handler: ScheddulerHandler): void {
    this.handlers.push(handler);
  }

  removeHandler(handler: ScheddulerHandler): void {
    const idx = this.handlers.indexOf(handler);
    if (idx != -1) this.handlers.splice(idx, 1);
  }

  currentTasks(): Iterable<TaskHandle> {
    return iter(this.tasks).map(t => t[0]);
  }

  private handleAdd(task: TaskHandleImpl) { for (const h of this.handlers) h.onTaskAdd(task) }
  private handleStop(task: TaskHandleImpl) { for (const h of this.handlers) h.onTaskStop(task) }
  private handleUpdate(task: TaskHandleImpl) { for (const h of this.handlers) h.onTaskUpdate(task) }

  PostFrame(msg: PostFrame) {
    this.nextTasks.clear();
    for (const ent of this.tasks) {
      const [handle, task] = ent;
      if (!handle.isStopped()) {
        const result = task.next(handle);
        this.handleUpdate(handle);
        if (result.done) handle.stop();
      }
      if (handle.isStopped()) this.handleStop(handle);
      else this.nextTasks.push(ent);
    }
    [this.nextTasks, this.tasks] = [this.tasks, this.nextTasks];
  }
}