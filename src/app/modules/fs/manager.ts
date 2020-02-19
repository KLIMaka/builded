import { Dependency, Injector } from "../../../utils/injector";
import { Table, span, stopPropagation } from "../../../utils/ui/ui";
import { UI, Ui, Window } from "../../apis/ui";

export interface FsManager {
  read(name: string): Promise<ArrayBuffer>;
  write(name: string, data: ArrayBuffer): Promise<void>;
  delete(name: string): Promise<void>;
  list(): Promise<string[]>
}
export const FS_MANAGER = new Dependency<FsManager>('FileSystem Manager');

class FileBrowser {
  private window: Window;
  private selected = new Set<string>();

  constructor(ui: Ui, private manager: FsManager) {
    this.window = ui.builder.windowBuilder()
      .id('fileBrowser')
      .title('Files')
      .draggable(true)
      .closeable(true)
      .centered(true)
      .size(600, 600)
      .toolbar('icon-arrows-ccw', () => this.refreshContent())
      .toolbar('icon-trash', () => this.deleteSelected())
      .build();

    const win = this.window.winElement;
    win.addEventListener("dragenter", stopPropagation, false);
    win.addEventListener("dragover", stopPropagation, false);
    win.addEventListener("drop", (e) => {
      stopPropagation(e);
      for (const file of e.dataTransfer.files) {
        const fileReader = new FileReader();
        const name = file.name;
        fileReader.readAsArrayBuffer(file);
        fileReader.onload = async e => {
          const data = <ArrayBuffer>e.target.result;
          await manager.write(name, data);
          this.refreshContent();
        }
      }
    }, false);

  }

  private async refreshContent() {
    const list = await this.manager.list();
    const table = new Table();
    table.className("table-striped");
    list.forEach(f => {
      const file = span().text(f);
      const row = table.row([file]);
      row.click(() => this.toggleItem(row.elem(), f));
    });
    this.replaceContent(table.elem());
  }

  private replaceContent(newContent: HTMLElement) {
    const content = this.window.contentElement.firstChild
    if (content) this.window.contentElement.removeChild(content);
    this.window.contentElement.appendChild(newContent);
  }

  private toggleItem(target: HTMLElement, name: string) {
    target.classList.toggle('selected');
    if (this.selected.has(name)) this.selected.delete(name)
    else this.selected.add(name);
  }

  private async deleteSelected() {
    for (const file of this.selected) await this.manager.delete(file)
    this.refreshContent();
  }


  public async show() {
    await this.refreshContent();
    this.window.show()
  }
}

let browser: FileBrowser;
async function getFileBrowser(injector: Injector) {
  if (browser == null) {
    browser = new FileBrowser(await injector.getInstance(UI), await injector.getInstance(FS_MANAGER));
  }
  return browser;
}

export async function showFileBrowser(injector: Injector) {
  const browser = await getFileBrowser(injector);
  browser.show();
}