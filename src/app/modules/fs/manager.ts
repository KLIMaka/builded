import { saveAs } from "../../../utils/filesave";
import { create, lifecycle, Module, plugin } from "../../../utils/injector";
import { iter } from "../../../utils/iter";
import { GridModel, IconText, IconTextRenderer, paneGroup, renderGrid, renderNav } from "../../../utils/ui/renderers";
import { addDragAndDrop, Element, replaceContent } from "../../../utils/ui/ui";
import { BUS, busDisconnector } from "../../apis/handler";
import { UI, Ui, Window } from "../../apis/ui";
import { namedMessageHandler } from "../../edit/messages";
import { FileSystem } from "./fs";
import { MOUNTS } from "./mount";

const columns = [IconTextRenderer];

class FileBrowser implements GridModel {
  private window: Window;
  private selected = new Set<string>();
  private activeFs: FileSystem;
  private dragAndDropHandler = (e: DragEvent) => {
    const writable = this.activeFs.write();
    if (writable == null) return;
    for (const file of e.dataTransfer.files) {
      const fileReader = new FileReader();
      const name = file.name;
      fileReader.readAsArrayBuffer(file);
      fileReader.onload = async e => {
        const data = <ArrayBuffer>e.target.result;
        await writable.write(name, data);
        this.refreshContent();
      }
    }
  }
  private sidebar: HTMLElement;
  private main: HTMLElement;

  constructor(ui: Ui, private mounts: FileSystem[]) {
    this.window = ui.builder.window()
      .title('Files')
      .draggable(true)
      .closeable(true)
      .centered(true)
      .size(800, 600)
      .toolbar(ui.builder.toolbar()
        .startGroup()
        .iconButton('icon-arrows-ccw', () => this.refreshContent())
        .iconButton('icon-download', () => this.downloadSelected())
        .iconButton('icon-trash', () => this.deleteSelected())
        .endGroup())
      .build();

    this.activeFs = mounts[0];
    const win = this.window.winElement;
    addDragAndDrop(win, this.dragAndDropHandler);
    const { root, sidebar, main } = paneGroup();
    this.sidebar = sidebar;
    this.main = main;
    replaceContent(this.window.contentElement, root);
  }

  public async stop() { this.window.destroy() }

  async rows() { return iter(await this.activeFs.list()).map(f => [{ text: f, icon: this.getIcon(f), style: this.selected.has(f) ? "selected" : "" }]) }
  columns() { return columns }
  onClick(row: [IconText], rowElement: Element) { this.toggleItem(rowElement.elem(), row[0].text) }

  private async refreshContent() {
    replaceContent(this.main, (await renderGrid(this)).elem());
    replaceContent(this.sidebar, renderNav({ name: "File Sources", items: [{ title: 'Local', icon: 'icon-home' }, { title: 'Remote', icon: 'icon-download' }] }))
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
    const writable = this.activeFs.write();
    if (writable == null) return;
    for (const file of this.selected) {
      await writable.delete(file)
      this.selected.delete(file);
    }
    this.refreshContent();
  }

  private async downloadSelected() {
    for (const file of this.selected) {
      saveAs(await this.activeFs.get(file), file);
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
    const browser = await create(injector, FileBrowser, UI, MOUNTS);
    lifecycle(bus.connect(namedMessageHandler('show_files', () => browser.show())), busDisconnector(bus));
    lifecycle(browser, b => b.stop());
  }));
}
