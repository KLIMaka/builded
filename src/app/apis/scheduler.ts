import { Injector } from '../../utils/injector';
import { Scheduler, TaskHandle } from './app';
import { Deck } from '../../utils/collections';

export async function SchedulerConstructor(injector: Injector) {
  return new SchedulerImpl();
}

class TaskHandleImpl implements TaskHandle {
  constructor(
    private stopped = false
  ) { }

  stop(): void { this.stopped = true }
  isStopped() { return this.stopped }
}

class SchedulerImpl implements Scheduler {
  private tasks = new Deck<[TaskHandleImpl, Generator]>();
  private nextTasks = new Deck<[TaskHandleImpl, Generator]>();

  addTask(task: Generator) {
    const handle = new TaskHandleImpl();
    this.tasks.push([handle, task]);
    return handle;
  }

  run(): void {
    this.nextTasks.clear();
    for (const ent of this.tasks) {
      const [handle, task] = ent;
      if (handle.isStopped()) continue;
      const result = task.next();
      if (result.done) handle.stop();
      else this.nextTasks.push(ent);
    }
    [this.nextTasks, this.tasks] = [this.tasks, this.nextTasks];
  }
}