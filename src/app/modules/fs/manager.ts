import { saveAs } from "../../../utils/filesave";
import { create, Dependency, lifecycle, Module, plugin } from "../../../utils/injector";
import { iter } from "../../../utils/iter";
import { GridModel, IconText, IconTextRenderer, renderGrid } from "../../../utils/ui/renderers";
import { addDragAndDrop, Element, replaceContent } from "../../../utils/ui/ui";
import { BUS, busDisconnector, BusPlugin } from "../../apis/handler";
import { UI, Ui, Window } from "../../apis/ui";
import { namedMessageHandler } from "../../edit/messages";

export interface FsManager {
  read(name: string): Promise<ArrayBuffer>;
  write(name: string, data: ArrayBuffer): Promise<any>;
  delete(name: string): Promise<any>;
  list(): Promise<string[]>
}
export const FS_MANAGER = new Dependency<FsManager>('FileSystem Manager');

export interface FsManagers {
  list(): string[];
  get(name: string): FsManager;
  add(name: string, manager: FsManager): void;
}

const columns = [IconTextRenderer];

class FileBrowser implements GridModel {
  private window: Window;
  private selected = new Set<string>();
  private dragAndDropHandler = (e: DragEvent) => {
    for (const file of e.dataTransfer.files) {
      const fileReader = new FileReader();
      const name = file.name;
      fileReader.readAsArrayBuffer(file);
      fileReader.onload = async e => {
        const data = <ArrayBuffer>e.target.result;
        await this.manager.write(name, data);
        this.refreshContent();
      }
    }
  }

  constructor(ui: Ui, private manager: FsManager) {
    this.window = ui.builder.window()
      .title('Files')
      .draggable(true)
      .closeable(true)
      .centered(true)
      .size(600, 600)
      .toolbar(ui.builder.toolbar()
        .startGroup()
        .iconButton('icon-arrows-ccw', () => this.refreshContent())
        .iconButton('icon-download', () => this.downloadSelected())
        .iconButton('icon-trash', () => this.deleteSelected())
        .endGroup())
      .build();

    const win = this.window.winElement;
    addDragAndDrop(win, this.dragAndDropHandler);
  }

  public async stop() {
    document.removeChild(this.window.winElement);
  }

  async rows() { return iter(await this.manager.list()).map(f => [{ text: f, icon: this.getIcon(f), style: this.selected.has(f) ? "selected" : "" }]) }
  columns() { return columns }
  onClick(row: [IconText], rowElement: Element) { this.toggleItem(rowElement.elem(), row[0].text) }

  private async refreshContent() {
    const table = await renderGrid(this);
    replaceContent(this.window.contentElement, table.elem());
  }

  private getIcon(name: string) {
    if (name.toLowerCase().endsWith('.map')) return 'icon-globe'
    if (name.toLowerCase().endsWith('.art')) return 'icon-picture'
    return 'icon-doc';
  }

  private toggleItem(target: HTMLElement, name: string) {
    target.classList.toggle('selected');
    if (this.selected.has(name)) this.selected.delete(name)
    else this.selected.add(name);
  }

  private async deleteSelected() {
    for (const file of this.selected) {
      await this.manager.delete(file)
      this.selected.delete(file);
    }
    this.refreshContent();
  }

  private async downloadSelected() {
    for (const file of this.selected) {
      saveAs(await this.manager.read(file), file);
      this.selected.delete(file);
    }
    this.refreshContent();
  }

  public async show() {
    await this.refreshContent();
    this.window.show()
  }
}

export async function FileBrowserModule(module: Module) {
  module.bind(plugin('FileBrowser'), lifecycle(async (injector, lifecycle) => {
    const bus = await injector.getInstance(BUS);
    const browser = await create(injector, FileBrowser, UI, FS_MANAGER);
    lifecycle(browser, b => b.stop())
    lifecycle(bus.connect(namedMessageHandler('show_files', () => browser.show())), busDisconnector(bus));
  }));
}
