import { create, getInstances, Injector, Module, plugin } from "../../utils/injector";
import { iter } from "../../utils/iter";
import { GridModel, renderGrid } from "../../utils/ui/renderers";
import { div, Element, replaceContent, span, tag } from "../../utils/ui/ui";
import { ScheddulerHandler, Scheduler, SCHEDULER, SchedulerTask, TaskHandle } from "../apis/app";
import { BUS, Handle } from "../apis/handler";
import { UI, Ui, Window } from "../apis/ui";
import { namedMessageHandler } from "../edit/messages";


class TaskWidget {
  private updateHandler: (s: string, progress: number) => void;
  constructor(readonly handle: TaskHandle) { }
  setUpdateHandler(handler: (s: string, progress: number) => void) { this.updateHandler = handler }
  update() { if (this.updateHandler != null) this.updateHandler(this.handle.getDescription(), this.handle.getProgress()) }
}

function TaskWidgetRenderer(w: TaskWidget): Element {
  const progress = tag('progress')
    .css('width', '90%')
    .css('height', '30px')
    .attr('max', "100");
  const cancel = span()
    .className('icon icon-cancel-circled')
    .css('font-size', '20px')
    .css('color', '#666')
    .css('float', 'right')
    .click(() => w.handle.stop());
  const descr = div('description')
    .css('padding-left', '10px');
  const container = div('task-container')
    .css('width', 'auto')
    .append(progress)
    .append(descr);
  w.setUpdateHandler((s, p) => {
    progress.attr('value', p);
    descr.text(s);
  });
  return div('task').append(cancel).append(container);
}

class TaskManager implements ScheddulerHandler {
  private tasks: TaskHandle[] = [];
  private taskWidgets: TaskWidget[] = [];
  private window: Window;
  private active = false;

  constructor(
    ui: Ui,
    scheduler: Scheduler
  ) {
    this.window = ui.builder.window()
      .title('Tasks')
      .draggable(true)
      .closeable(true)
      .centered(true)
      .size(600, 600)
      .build();
    this.window.onclose = () => this.active = false;
    scheduler.addHandler(this);
    for (const task of scheduler.currentTasks()) this.onTaskAdd(task);
  }

  onTaskAdd(task: TaskHandle): void {
    this.tasks.push(task);
    this.taskWidgets.push(new TaskWidget(task));
    this.refreshGrid();
  }

  onTaskStop(task: TaskHandle): void {
    const idx = this.tasks.indexOf(task);
    if (idx != -1) {
      this.tasks.splice(idx, 1);
      this.taskWidgets.splice(idx, 1);
      this.refreshGrid();
    }
  }

  onTaskUpdate(task: TaskHandle): void {
    if (!this.active) return;
    const idx = this.tasks.indexOf(task);
    if (idx != -1) this.taskWidgets[idx].update();
  }

  private gridModel = this.createGridModel();
  private createGridModel(): GridModel {
    const columns = [TaskWidgetRenderer];
    const self = this;
    return {
      async rows() { return iter(self.taskWidgets).map(f => [f]) },
      columns() { return columns },
      onClick(row: any[], rowElement: Element) { }
    }
  }

  private async refreshGrid() {
    if (!this.active) return;
    replaceContent(this.window.contentElement, (await renderGrid(this.gridModel)).elem());
  }

  public async show() {
    this.active = true;
    await this.refreshGrid();
    this.window.show()
  }
}

function* task(): SchedulerTask {
  let handler = yield;
  for (let i = 0; i < 100; i++) {
    handler.setDescription(`Task ${i}%`);
    handler.setProgress(i);
    yield;
  }
}

export async function TaskManagerModule(module: Module) {
  let showTasksHandle: Handle;
  let addTaskTestHandle: Handle;
  let manager: TaskManager;
  module.bind(plugin('TaskManager'), {
    start: async injector => {
      const [bus, scheduler, ui] = await getInstances(injector, BUS, SCHEDULER, UI);
      manager = new TaskManager(ui, scheduler);
      showTasksHandle = bus.connect(namedMessageHandler('show_tasks', () => manager.show()));
      addTaskTestHandle = bus.connect(namedMessageHandler('add_test_task', () => scheduler.addTask(task())));
    },
    stop: async injector => {
      const bus = await injector.getInstance(BUS);
      bus.disconnect(showTasksHandle);
      bus.disconnect(addTaskTestHandle);
    }
  });
}
