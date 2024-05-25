import { App as AppInjector, Dependency, getInstances, instance, provider } from "@utils/injector";
import { iter } from "@utils/iter";
import { LazyValue } from "@utils/objects";
import { Oracle } from "@utils/ui/controls/api";
import { ACTION_DESCRIPTORS, Action, ActionDescriptors } from "app/apis/actions";
import { ActionsWidget, WindowBuilder } from "app/apis/ui";
import { UI, Ui } from "app/apis/ui1";
import { InputController } from "app/input/keymap";
import { DefaultActionsConstructor } from "app/modules/default/app/actions";
import { FS_MANAGER, FileSystemsManagerModule as FileSystemsManagerConstructor } from "app/modules/fs/ui/model";
import { menuItem, searchList } from "app/modules/ui/builders";
import { ReactUiModule } from "app/modules/ui/react-ui";
import { enableMapSet } from "immer";
import { APP, App } from "./app/apis/app1";
import { FS } from "./app/apis/fs";
import { DefaultApp } from "./app/modules/default/app/app";
import { DefaultLifecycleListener } from "./app/modules/default/lifecycle-listener";
import { DefaultFileSystems, GLOBAL_FS_HANDLERS, inMemoryFS, storageFS } from "./app/modules/fs/fs";
import { GLOBAL_CALLBACK_HANDLERS } from "@utils/callbacks";

const app = DefaultApp("App");
const injector = new AppInjector(new DefaultLifecycleListener(app.timer, app.logger));
enableMapSet();

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

function gtBind(l: Action, r: Action): Action {
  return l.descriptor.bind().map(b => b.length()).orElse(0) > r.descriptor.bind().map(b => b.length()).orElse(0) ? l : r
}

const kbe = (handler: (key: string) => boolean) => (e: KeyboardEvent) => {
  if (e.repeat && (e.key === 'Shift' || e.key === 'Alt' || e.key === 'Control')) return;
  if (!handler(e.key.toLowerCase())) return;
  e.preventDefault();
  return false;
}


app.scheduler.exec(async handler => {
  injector.bind(APP, instance(app));
  injector.bind(ACTION_DESCRIPTORS, DefaultActionsConstructor);
  injector.bind(FS_MANAGER, FileSystemsManagerConstructor);
  injector.bind(FS, provider(i => createFs(app)));
  injector.install(ReactUiModule);

  async function createFs(app: App) {
    const fs = DefaultFileSystems();
    fs.mount("Storage", await handler.waitFor(storageFS("root", app.storages, app.timer)));
    fs.mount("InMemory", inMemoryFS(app.timer));
    return fs;
  }

  injector.bind(new Dependency<void>("", true), provider(async i => {
    const [ui, actions, fsManager] = await getInstances(i, UI, ACTION_DESCRIPTORS, FS_MANAGER);

    ui.globalActions().add(
      actions.bindSync('test1', () => console.log(`FS_HANDLERS=${GLOBAL_FS_HANDLERS} VALUE_HANDLERS=${GLOBAL_CALLBACK_HANDLERS}`)),
      actions.bindSync('test', async () => ui.showWindow(await fsManager.newWindow()))
    )

    const ctl = new InputController();
    const keyup = kbe(key => { ctl.update(key, false); return false });
    const keydown = kbe(key => {
      ctl.update(key, true);
      return iter(ui.actions())
        .filter(a => a.enabled.get() && a.descriptor.bind().map(b => ctl.isPressed(b)).orElse(false))
        .reduceFirst(gtBind)
        .map(a => {
          app.logger.log('INFO', a.descriptor.id);
          app.scheduler.exec(a.handler);
          return true
        })
        .orElse(false);
    });
    window.addEventListener('blur', () => ctl.reset());
    document.body.addEventListener('keyup', keyup);
    document.body.addEventListener('keydown', keydown);
  }));

  await handler.waitFor(injector.start());
});
