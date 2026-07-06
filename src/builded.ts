import { GL_CONTEXT } from "@utils/gl/drawstruct";
import { ACTION_DESCRIPTORS, Action } from "app/apis/actions";
import { UI } from "app/apis/ui";
import { VALUES } from "app/apis/values";
import { InputController } from "app/input/keymap";
import { DefaultActionsConstructor } from "app/modules/default/app/actions";
import { DefaultLogger } from "app/modules/default/app/logger";
import { DefaultValuesConstructor } from "app/modules/default/values";
import { createEngines } from "app/modules/engine-context/ui/engine-context";
import { FS_MANAGER, FileSystemsManagerModule as FileSystemsManagerConstructor } from "app/modules/fs/ui/fs-model";
import { DefaultGlContextConstructor } from "app/modules/gl/gl-context";
import { createRectifier } from "app/modules/rectifier/ui/rectifier";
import { createSettings } from "app/modules/settings/settings";
import { ReactUiConstructor } from "app/modules/ui/react-ui";
import { enableMapSet, enablePatches } from "immer";
import { App as AppInjector, Dependency, getInstances, provider } from "ts-utils/injector";
import { iter } from "ts-utils/iter";
import { APP } from "./app/apis/app";
import { FS } from "./app/apis/fs";
import { DefaultAppConstructor } from "./app/modules/default/app/app";
import { DefaultLifecycleListener } from "./app/modules/default/lifecycle-listener";
import { DefaultFileSystemsConstructor, GLOBAL_FS_HANDLERS } from "./app/modules/fs/fs";



function gtBind(l: Action, r: Action): Action {
  return l.descriptor.bind().map(b => b.length()).orElse(0) >= r.descriptor.bind().map(b => b.length()).orElse(0) ? l : r
}

const kbe = (handler: (key: string) => boolean) => (e: KeyboardEvent) => {
  if (e.repeat && (e.key === 'Shift' || e.key === 'Alt' || e.key === 'Control')) return;
  const handled = handler(e.key.toLowerCase());
  if (handled || e.key === 'Alt') {
    e.preventDefault();
    return false;
  }
}

enableMapSet();
enablePatches();

const injector = new AppInjector(new DefaultLifecycleListener(() => performance.now(), DefaultLogger()));
injector.bind(APP, DefaultAppConstructor('App'));
injector.bind(ACTION_DESCRIPTORS, DefaultActionsConstructor);
injector.bind(FS_MANAGER, FileSystemsManagerConstructor);
injector.bind(FS, DefaultFileSystemsConstructor);
injector.bind(VALUES, DefaultValuesConstructor);
injector.bind(GL_CONTEXT, DefaultGlContextConstructor);
injector.bind(UI, ReactUiConstructor);

injector.bind(new Dependency<void>("", true), provider(async i => {
  const [ui, actions, fsManager, app] = await getInstances(i, UI, ACTION_DESCRIPTORS, FS_MANAGER, APP);

  window.addEventListener('beforeunload', () => app.dispose());

  ui.globalActions().add(
    actions.bindSync('test1', () => app.logger.log('INFO', `FS_HANDLERS=${GLOBAL_FS_HANDLERS}`)),
    actions.bind('test', async () => ui.addWindow(await fsManager.openWindow())),
    actions.bind('rectifier', async () => ui.addWindow(await createRectifier(i))),
    actions.bind('engines-context', async () => ui.addWindow(await createEngines(i))),
    actions.bind('settings', async () => ui.addWindow(await createSettings(i))),
  );

  const handle = (): boolean => iter(ui.actions())
    .filter(a => a.enabled.get() && a.descriptor.bind().map(b => ctl.isPressed(b)).orElse(false))
    .reduceFirst(gtBind)
    .map(a => {
      app.logger.log('INFO', a.descriptor.id);
      const task = app.scheduler.exec(_ => a.handler());
      task.end().then(result => result.onErr(error => app.logger.log('ERROR', error)))
      return true
    })
    .orElse(false)

  const ctl = new InputController();
  const updateStataes = () => iter(ui.states()).forEach(s => s.action(ctl.isPressed(s.bind)));
  const keyup = kbe(key => {
    ctl.update(key, false);
    updateStataes();
    return false;
  });
  const keydown = kbe(key => {
    ctl.update(key, true);
    updateStataes();
    return handle();
  });
  const mouseup = (e: MouseEvent) => {
    ctl.update(`mouse${e.button}`, false);
    updateStataes();
  }
  const mousedown = (e: MouseEvent) => {
    ctl.update(`mouse${e.button}`, true);
    updateStataes();
  }
  const wheel = (e: WheelEvent) => {
    const key = e.deltaY > 0 ? "wheelup" : "wheeldown";
    ctl.update(key, true);
    const handled = handle();
    ctl.update(key, false);
    if (handled) e.preventDefault();
  }
  window.addEventListener('blur', () => ctl.reset());
  document.body.addEventListener('keyup', keyup);
  document.body.addEventListener('keydown', keydown);
  document.body.addEventListener('mousedown', mousedown);
  document.body.addEventListener('mouseup', mouseup);
  document.body.addEventListener('wheel', wheel);
  document.body.addEventListener('contextmenu', e => e.preventDefault());

}));

injector.start();
