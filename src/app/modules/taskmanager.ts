import { create, Injector } from "../../utils/injector";
import { iter } from "../../utils/iter";
import { GridModel, renderGrid } from "../../utils/ui/renderers";
import { div, Element, tag } from "../../utils/ui/ui";
import { ScheddulerHandler, Scheduler, SCHEDULER, TaskHandle } from "../apis/app";
import { BUS } from "../apis/handler";
import { UI, Ui, Window } from "../apis/ui";
import { namedMessageHandler } from "../edit/messages";


class TaskWidget {
  private updateHandler: (s: string, progress: number) => void;
  constructor(readonly handle: TaskHandle) { }
  setUpdateHandler(handler: (s: string, progress: number) => void) { this.updateHandler = handler }
  update() { if (this.updateHandler != null) this.updateHandler(this.handle.getDescription(), this.handle.getProgress()) }
}

function TaskWidgetRenderer(w: TaskWidget): Element {
  const progress = tag('progress').attr('max', "100");
  const cancel = div('cancel').text("X").click(() => w.handle.stop());
  const descr = div('description');
  w.setUpdateHandler((s, p) => {
    progress.attr('value', p);
    descr.text(s);
  });
  const widget = div('task')
    .append(progress)
    .append(descr)
    .append(cancel);
  return widget;
}

class TaskManager implements ScheddulerHandler {
  private tasks: TaskHandle[] = [];
  private taskWidgets: TaskWidget[] = [];
  private window: Window;

  constructor(
    ui: Ui,
    scheduler: Scheduler
  ) {
    scheduler.addHandler(this);
    this.window = ui.builder.window()
      .title('Tasks')
      .draggable(true)
      .closeable(true)
      .centered(true)
      .size(600, 600)
      .build();
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
    const table = await renderGrid(this.gridModel);
    this.replaceContent(table.elem());
  }

  private replaceContent(newContent: HTMLElement) {
    const content = this.window.contentElement.firstChild
    if (content) this.window.contentElement.replaceChild(newContent, content);
    else this.window.contentElement.appendChild(newContent);
  }

  public async show() {
    await this.refreshGrid();
    this.window.show()
  }
}

let manager: TaskManager;
async function getTaskManager(injector: Injector) {
  if (manager == null) manager = await create(injector, TaskManager, UI, SCHEDULER);
  return manager;
}

export async function showTasks(injector: Injector) {
  const browser = await getTaskManager(injector);
  browser.show();
}

export async function TaskManagerModule(injector: Injector) {
  const bus = await injector.getInstance(BUS);
  bus.connect(namedMessageHandler('show_tasks', () => showTasks(injector)));
}
