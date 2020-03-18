import { Dependency, Injector, create } from "../../../utils/injector";
import { span, stopPropagation, Table, addDragAndDrop } from "../../../utils/ui/ui";
import { BUS } from "../../apis/handler";
import { UI, Ui, Window } from "../../apis/ui";
import { namedMessageHandler } from "../../edit/messages";

export interface FsManager {
  read(name: string): Promise<ArrayBuffer>;
  write(name: string, data: ArrayBuffer): Promise<any>;
  delete(name: string): Promise<any>;
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
    addDragAndDrop(win, e => {
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
    })
  }

  private async refreshContent() {
    const list = await this.manager.list();
    const table = new Table();
    table.className("table-striped");
    list.forEach(f => {
      const file = span().className('icon-text').text(f)
        .append(span().className('icon pull-left ' + this.getIcon(f)));
      const row = table.row([file]);
      row.click(() => this.toggleItem(row.elem(), f));
    });
    this.replaceContent(table.elem());
  }

  private getIcon(name: string) {
    if (name.toLowerCase().endsWith('.map')) return 'icon-globe'
    if (name.toLowerCase().endsWith('.art')) return 'icon-picture'
    return 'icon-doc';
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
  if (browser == null) browser = await create(injector, FileBrowser, UI, FS_MANAGER);
  return browser;
}

export async function showFileBrowser(injector: Injector) {
  const browser = await getFileBrowser(injector);
  browser.show();
}

export async function FileBrowserModule(injector: Injector) {
  const bus = await injector.getInstance(BUS);
  bus.connect(namedMessageHandler('show_files', () => showFileBrowser(injector)));
}
