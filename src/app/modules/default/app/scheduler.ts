import { TaskHandle, Scheduler, ScheddulerHandler, SchedulerTask, Handle, Timer } from "app/apis/app1";
import { Deck } from "utils/collections";
import { iter } from "utils/iter";
import { StopWatch, measure } from "utils/time";

class TaskHandleImpl implements TaskHandle {
  constructor(
    private stopped = false,
    public description = "",
    public progress = -1,
  ) { }


  stop(): void { this.stopped = true }
  isStopped() { return this.stopped }
  getDescription(): string { return this.description }
  getProgress(): number { return this.progress }
  setDescription(s: string): void { this.description = s }
  setProgress(p: number): void { this.progress = p }
}

class TaskInfo {
  name: string;
  description: string;
  progress: number;
  lastTime: number;
}



type Task = { handle: TaskHandleImpl, task: SchedulerTask };
type TaskStats = { time: number, task: TaskHandle };
type RunStats = { taskStats: TaskStats, lastRunTime: number };


class SchedulerImpl implements Scheduler {
  private tasks = new Deck<Task>();
  private nextTasks = new Deck<Task>();
  private handlers: Set<ScheddulerHandler> = new Set();
  private lastRun = 0;

  constructor(private timer: Timer) {
    requestAnimationFrame(() => this.run());
  }

  addTask(task: SchedulerTask): TaskHandle {
    const handle = new TaskHandleImpl();
    this.tasks.push({ handle, task });
    this.handleAdd(handle);
    return handle;
  }

  addHandler(handler: ScheddulerHandler): Handle {
    this.handlers.add(handler);
    const remove = () => this.handlers.delete(handler);
    return { remove };
  }

  currentTasks(): Iterable<TaskHandle> {
    return iter(this.tasks).map(t => t.handle);
  }

  private handleAdd(task: TaskHandleImpl) { for (const h of this.handlers) h.onTaskAdd(task) }
  private handleStop(task: TaskHandleImpl) { for (const h of this.handlers) h.onTaskStop(task) }
  private handleUpdate(task: TaskHandleImpl) { for (const h of this.handlers) h.onTaskUpdate(task) }


  private run() {
    const sinceLastRun = this.timer() - this.lastRun;
    this.nextTasks.clear();
    for (const ent of this.tasks) {
      const { handle, task } = ent;
      if (!handle.isStopped()) {
        const [result, taskTime] = measure(() => task.next(handle), this.timer);
        if (result.value) this.handleUpdate(handle);
        if (result.done) handle.stop();
      }
      if (handle.isStopped()) this.handleStop(handle);
      else this.nextTasks.push(ent);
    }
    this.tasks = this.nextTasks;

    requestAnimationFrame(() => this.run());
  }
}

export function DefaultScheduler(timer: Timer) {
  return new SchedulerImpl(timer);
}