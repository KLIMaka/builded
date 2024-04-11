import { App as AppInjector, Dependency, getInstances, instance, provider } from "@utils/injector";
import { iter } from "@utils/iter";
import { LazyValue } from "@utils/objects";
import { size } from "@utils/size";
import { Oracle } from "@utils/ui/controls/api";
import { addDragAndDrop } from "@utils/ui/ui";
import { ACTION_DESCRIPTORS, Action, ActionDescriptors } from "app/apis/actions";
import { ActionsWidget, UI, Ui, WindowBuilder } from "app/apis/ui";
import { InputController } from "app/input/keymap";
import { ArtEditorModule } from "app/modules/arteditor";
import { createEngineContext } from "app/modules/blood/module1";
import { DefaultActionsConstructor } from "app/modules/default/app/actions";
import { Painter } from "app/modules/painter/painter";
import { button, checkMenuItem, column, columnGroup, iconText, menu, menuItem, searchList, table } from "app/modules/ui/builders";
import { PhotonUiModule } from "app/modules/ui/photonui";
import { APP, App, Scheduler } from "./app/apis/app1";
import { FS, FileSystem, FileSystems } from "./app/apis/fs";
import { DefaultApp } from "./app/modules/default/app/app";
import { DefaultFileSystems, createLocalFs, createRffFs, createZipFs, fetchFs, inMemoryFS, storageFS } from "./app/modules/default/app/fs";
import { DefaultLifecycleListener } from "./app/modules/default/lifecycle-listener";
import { measure, printTime } from "@utils/time";

const app = DefaultApp("App");
const injector = new AppInjector(new DefaultLifecycleListener(app.timer, app.logger));

async function testFs(ui: Ui, app: App, fs: FileSystem) {
  const [arteditor, time] = await measure(async () => {
    const engine = await createEngineContext(fs);
    return await ArtEditorModule(ui, engine);

  }, app.timer)
  app.logger.log('INFO', `ArtEditor started in ${printTime(time)}`);
  arteditor.show();
}

function fsAction(ui: Ui, app: App, fs: FileSystems): Action {
  const win = new LazyValue(() => {
    const fsActions = ui.actionDescriptors().sub('fs');
    const addMenu = menu(ui, [
      menuItem(ui, fsActions.bind('add_dir', addDirectory)),
      menuItem(ui, fsActions.bind('add_zip', addZip)),
      menuItem(ui, fsActions.bind('add_rff', addRff)),
      checkMenuItem(ui, 'Check')
    ]);

    const showMenu = async () => addMenu.show(addButton);
    const menuAction = fsActions.bind('add_res', showMenu);
    const addButton = button(ui, showMenu).text('Add...');
    const testFsButton = button(ui, () => testFs(ui, app, currentFs)).text('Test FS');

    const list = columnGroup<string>(ui, ['padded-5'], ['group-label']);
    let currentFs: FileSystem = null;
    const getExtension = async (s: string) => { const idx = s.lastIndexOf('.'); return idx == -1 ? "" : s.substring(idx + 1).toUpperCase() }
    const getSize = async (s: string) => currentFs.getSize(s).then(o => size(o.orElse(0)));

    const tableWidget = table<string>(ui, ['padded-5'], [
      column('Name', async r => r, (b, v) => iconText(b, 'file', v)),
      column('Type', getExtension, (b, v) => b.block().text(v), '50px'),
      column('Size', getSize, (b, v) => b.block().text(v), '90px'),
    ]);

    list.addChangeHandler(refreshTable);
    refreshList();
    list.select(fs.list()[0]);

    async function addDirectory() {
      const handle = await window.showDirectoryPicker();
      tableWidget.clear();
      const name = handle.name;
      fs.mount(name, createLocalFs(handle));
      refreshTable(name);
      refreshList();
    }

    async function addZip() {
      try {
        const [handle] = await window.showOpenFilePicker({ types: [{ description: 'Zip File', accept: { 'application/zip': '.zip' } }] });
        const fileData = await handle.getFile();
        fs.mount(handle.name, await createZipFs(fileData));
        refreshTable(handle.name);
        refreshList();
      } catch {

      }
    }

    async function addRff() {
      const [handle] = await window.showOpenFilePicker({ types: [{ description: 'Rff File', accept: { 'application/rff': '.rff' } }] });
      const fileData = await handle.getFile();
      fs.mount(handle.name, await createRffFs(fileData));
      refreshTable(handle.name);
      refreshList();
    }

    function refreshList() {
      list.clear();
      const roots = fs.list();
      roots.forEach(v => list.addItem(v));
    }

    async function refreshTable(root: string) {
      const nfs = fs.get(root).get();
      currentFs = nfs;
      const filenames = await nfs.list();
      tableWidget.clear();
      filenames.forEach(fn => tableWidget.addRow(fn));
      list.select(root);
    }

    addDragAndDrop(tableWidget.asWidget().cast(), async e => {
      const files = e.dataTransfer.files;
      if (files.length == 0) return;
      const writableOpt = await currentFs.write();
      if (!writableOpt.isPresent()) return;
      const w = writableOpt.get();
      const writes = [];
      for (const file of files) {
        const name = file.name;
        const fileReader = new FileReader();
        fileReader.readAsArrayBuffer(file);
        writes.push(new Promise<void>((ok, error) => {
          fileReader.onload = e => w.write(name, <ArrayBuffer>e.target.result).then(ok, error);
          fileReader.onerror = e => error(e);
        }));
      }
      await Promise.allSettled(writes);
      refreshTable(list.selected());
    });

    const builder = new WindowBuilder()
      .size(800, 400)
      .title(ui.block().text('Title'))
      .contentWidget(
        ui.column()
          .widget(ui.row(['padded-5']).insert(addButton).insert(testFsButton))
          .widget(ui.row()
            .widget(list, '150px')
            .widget(tableWidget, '1'), '1'))
      .actions([...tableWidget.actions(), menuAction]);

    return ui.createWindow(builder);
  });

  return ui.actionDescriptors().bindSync('fs', () => ui.showWindow(win.get()));
}

function actionsAction(ui: Ui, act: ActionDescriptors): Action {
  let actionsList: Action[] = [];
  const oracle: Oracle<ActionsWidget> = s => {
    const seach = s.toLowerCase();
    return iter(actionsList)
      .filter(a => a.descriptor.label().orElse('').toLowerCase().includes(seach))
      .map(a => menuItem(ui, a))
  }
  const actions = searchList(ui, oracle, _ => false);
  actions.setSelectCallback(() => ui.hideWindow(win.get()));

  const win = new LazyValue(() => {
    const builder = new WindowBuilder()
      .size(400, 400)
      .minSize(400, 400)
      .content(actions.asWidget())
      .actionsProvider(() => actions.actions())
      .autoclose();

    return ui.createWindow(builder);
  });

  return act.bind('actions', async () => {
    actionsList = [...ui.actions()];
    actions.resetList();
    ui.showWindow(win.get());
    actions.focusSearchbar()
  });
}

function painterAction(ui: Ui, actions: ActionDescriptors, shceduler: Scheduler) {
  const painter = new LazyValue(() => new Painter(ui, actions, shceduler));
  return actions.bind('painter', async () => painter.get().show());
}

const kbe = (handler: (key: string) => boolean) => (e: KeyboardEvent) => {
  if (e.repeat && (e.key == 'Shift' || e.key == 'Alt' || e.key == 'Control')) return;
  if (!handler(e.key.toLowerCase())) return;
  e.preventDefault();
  return false;
}

app.scheduler.exec(async handler => {
  injector.bind(APP, instance(app));
  injector.bind(ACTION_DESCRIPTORS, DefaultActionsConstructor);
  injector.install(PhotonUiModule);
  injector.bind(FS, provider(i => createFs(app)));

  async function createFs(app: App) {
    const fs = DefaultFileSystems();
    fs.mount("Storage", await handler.waitFor(storageFS("root", app.storages)));
    fs.mount("Base", fetchFs(""));
    fs.mount("InMemory", inMemoryFS());
    return fs;
  }

  injector.bind(new Dependency<void>("", true), provider(async i => {
    const [ui, fs, actions] = await getInstances(i, UI, FS, ACTION_DESCRIPTORS);
    const globalActions = [
      fsAction(ui, app, fs),
      actionsAction(ui, actions),
      painterAction(ui, actions, app.scheduler),
    ];

    const ctl = new InputController();
    const keyup = kbe(key => { ctl.update(key, false); return false });
    const keydown = kbe(key => {
      ctl.update(key, true);
      return iter(globalActions).chain(ui.actions())
        .filter(a => a.descriptor.bind().map(b => ctl.isPressed(b)).orElse(false))
        .reduceFirst((l, r) => l.descriptor.bind().map(b => b.length()).orElse(0) > r.descriptor.bind().map(b => b.length()).orElse(0) ? l : r)
        .map(a => { app.scheduler.exec(a.handler); return true })
        .orElse(false);
    });
    window.addEventListener('blur', () => ctl.reset());
    document.body.addEventListener('keyup', keyup);
    document.body.addEventListener('keydown', keydown);
  }));

  await handler.waitFor(injector.start());
});
