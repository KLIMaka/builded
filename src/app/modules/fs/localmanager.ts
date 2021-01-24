import { getInstances, provider } from "../../../utils/injector";
import { iter } from "../../../utils/iter";
import { IconText, IconTextRenderer, renderGrid } from "../../../utils/ui/renderers";
import { Element, replaceContent } from "../../../utils/ui/ui";
import { Storage, STORAGES } from "../../apis/app";
import { UI, Ui, Window } from "../../apis/ui";
import { FileSystem } from "./fs";
import { createLocalFs } from "./local";

class LocalFsManager {
  private window: Window;
  private roots = new Map<string, FileSystemDirectoryHandle>();

  constructor(ui: Ui, private localFsStorage: Storage) {
    this.window = ui.builder.window()
      .title('Select Root')
      .draggable(true)
      .closeable(true)
      .centered(true)
      .size(600, 600)
      .toolbar(ui.builder.toolbar()
        .iconButton('icon-arrows-ccw', () => this.addRoot()))
      .build();
  }

  public getRoot(): Promise<FileSystem> {
    return new Promise(async resolve => {
      const roots = await this.localFsStorage.keys();
      await Promise.all(iter(roots).map(r => this.localFsStorage.get(r).then(h => this.roots.set(r, h))).collect());
      const table = await renderGrid(this.gridModel(resolve));
      replaceContent(this.window.contentElement, table.elem());
      this.window.show();
    });
  }

  private gridModel(resolve: (fs: Promise<FileSystem>) => void) {
    const columns = [IconTextRenderer];
    const item = (f: string) => { return { text: f, icon: '', style: '' } };
    const self = this;
    return {
      async rows() { return iter(self.roots.keys()).map(f => [item(f)]) },
      columns() { return columns },
      onClick(row: [IconText], rowElement: Element) { resolve(self.openRoot(self.roots.get(row[0].text))) }
    }
  };

  private async addRoot() {
    const handle = await window.showDirectoryPicker();
    this.localFsStorage.set(handle.name, handle);
    this.openRoot(handle);
  }

  private async openRoot(handle: FileSystemDirectoryHandle) {
    if (!await this.verifyPermission(handle)) return;
    return createLocalFs(handle);
  }

  private async verifyPermission(handle: FileSystemDirectoryHandle) {
    const options: FileSystemHandlePermissionDescriptor = { mode: "readwrite" };
    if ((await handle.queryPermission(options)) === 'granted') return true;
    if ((await handle.requestPermission(options)) === 'granted') return true;
    return false;
  }
}

export const LocalFsProvider = provider(async injector => {
  const [ui, storages] = await getInstances(injector, UI, STORAGES);
  const manager = new LocalFsManager(ui, await storages('local-fs-storage'));
  return manager.getRoot();
});