import { Deck } from '../../utils/collections';
import { Injector } from '../../utils/injector';
import { PostFrame } from '../edit/messages';
import { Scheduler, TaskHandle } from './app';
import { BUS, MessageHandlerReflective } from './handler';

export async function DefaultScheduler(injector: Injector) {
  const bus = await injector.getInstance(BUS);
  const scheduler = new SchedulerImpl();
  bus.connect(scheduler);
  return scheduler;
}

class TaskHandleImpl implements TaskHandle {
  constructor(
    private stopped = false
  ) { }

  stop(): void { this.stopped = true }
  isStopped() { return this.stopped }
}

class SchedulerImpl extends MessageHandlerReflective implements Scheduler {
  private tasks = new Deck<[TaskHandleImpl, Generator]>();
  private nextTasks = new Deck<[TaskHandleImpl, Generator]>();

  addTask(task: Generator) {
    const handle = new TaskHandleImpl();
    this.tasks.push([handle, task]);
    return handle;
  }

  PostFrame(msg: PostFrame) {
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