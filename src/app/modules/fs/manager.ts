import { Dependency, Injector } from "../../../utils/injector";
import { Table, span } from "../../../utils/ui/ui";
import { UI, Ui, Window } from "../../apis/ui";

export interface FsManager {
  read(name: string): Promise<ArrayBuffer>;
  write(name: string, data: ArrayBuffer): Promise<void>;
  delete(name: string): Promise<void>;
  list(): Promise<string[]>
}
export const FS_MANAGER = new Dependency<FsManager>('FileSystem Manager');

function drag(e) {
  e.stopPropagation();
  e.preventDefault();
}


class FileBrowser {
  private window: Window;
  private fileReader = new FileReader();

  constructor(ui: Ui, private manager: FsManager) {
    this.window = ui.builder.windowBuilder()
      .id('fileBrowser')
      .title('Files')
      .draggable(true)
      .closeable(true)
      .centered(true)
      .size(600, 600)
      .build();

    const win = this.window.winElement;
    win.addEventListener("dragenter", drag, false);
    win.addEventListener("dragover", drag, false);
    win.addEventListener("drop", (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.fileReader.readAsArrayBuffer(e.dataTransfer.files[0])
    }, false);

    this.fileReader.onload = async e => {
      const data = <ArrayBuffer>e.target.result;
      await manager.write('file.txt', data);
      this.refreshContent();
    }
  }

  private async refreshContent() {
    const list = await this.manager.list();
    const table = new Table();
    table.className("table-striped");
    list.forEach(f => table.row([span().text(f)]));
    this.replaceContent(table.elem());
  }

  private replaceContent(newContent: HTMLElement) {
    const content = this.window.contentElement.firstChild
    if (content) this.window.contentElement.removeChild(content);
    this.window.contentElement.appendChild(newContent);
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