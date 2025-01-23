import { CONTAINERS } from "@utils/callbacks";
import { App as AppInjector, Dependency, getInstances, instance, provider } from "@utils/injector";
import { iter } from "@utils/iter";
import { ACTION_DESCRIPTORS, Action } from "app/apis/actions";
import { UI, Window } from "app/apis/ui1";
import { InputController } from "app/input/keymap";
import { DefaultActionsConstructor } from "app/modules/default/app/actions";
import { createEngines } from "app/modules/engine-context/ui/engine-context";
import { FS_MANAGER, FileSystemsManagerModule as FileSystemsManagerConstructor } from "app/modules/fs/ui/fs-model";
import { createRectifier } from "app/modules/rectifier/ui/rectifier";
import { ReactUiModule } from "app/modules/ui/react-ui";
import { enableMapSet } from "immer";
import { APP } from "./app/apis/app1";
import { FS } from "./app/apis/fs";
import { DefaultApp } from "./app/modules/default/app/app";
import { DefaultLifecycleListener } from "./app/modules/default/lifecycle-listener";
import { DefaultFileSystemsConstructor, GLOBAL_FS_HANDLERS } from "./app/modules/fs/fs";
import { GL_CONTEXT } from "@utils/gl/drawstruct";
import { createGlContext } from "app/modules/gl/gl-context";

const app = DefaultApp("App");
const injector = new AppInjector(new DefaultLifecycleListener(app.timer, app.logger));
enableMapSet();

function gtBind(l: Action, r: Action): Action {
  return l.descriptor.bind().map(b => b.length()).orElse(0) >= r.descriptor.bind().map(b => b.length()).orElse(0) ? l : r
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
  injector.bind(FS, DefaultFileSystemsConstructor);
  injector.bind(GL_CONTEXT, provider(async i => createGlContext()));
  injector.install(ReactUiModule);

  injector.bind(new Dependency<void>("", true), provider(async i => {
    const [ui, actions, fsManager, glCtx] = await getInstances(i, UI, ACTION_DESCRIPTORS, FS_MANAGER, GL_CONTEXT);

    let rectWindow: Window;
    ui.globalActions().add(
      actions.bindSync('test1', () => console.log(`FS_HANDLERS=${GLOBAL_FS_HANDLERS} VALUE_CONTAINERS=${iter(CONTAINERS.values()).map(v => v.name).collect()} TOTAL_VALUES=${iter(CONTAINERS.values()).map(c => c.size()).reduceFirst((l, r) => l + r).orElse(0)} GL_RESOURCES=${glCtx.info()}`)),
      actions.bind('test', async () => { ui.addWindow(await fsManager.newWindow()) }),
      actions.bind('rectifier', async () => { rectWindow = await createRectifier(i); ui.addWindow(rectWindow) }),
      actions.bind('engines-context', async () => { rectWindow = await createEngines(i); ui.addWindow(rectWindow) }),
      // actions.bind('test1', async () => rectWindow.focus())
    );

    const ctl = new InputController();
    const keyup = kbe(key => {
      ctl.update(key, false);
      iter(ui.states()).forEach(s => s.action(ctl.isPressed(s.bind)));
      return false
    });
    const keydown = kbe(key => {
      ctl.update(key, true);
      iter(ui.states()).forEach(s => s.action(ctl.isPressed(s.bind)));
      return iter(ui.actions())
        .filter(a => a.enabled.get() && a.descriptor.bind().map(b => ctl.isPressed(b)).orElse(false))
        .reduceFirst(gtBind)
        .map(a => {
          app.logger.log('INFO', a.descriptor.id);
          const task = app.scheduler.exec(_ => a.handler());
          task.end().then(result => result.onErr(error => app.logger.log('ERROR', error)))
          return true
        })
        .orElse(false);
    });
    window.addEventListener('blur', () => ctl.reset());
    document.body.addEventListener('keyup', keyup);
    document.body.addEventListener('keydown', keydown);
  }));

  await handler.waitFor(injector.start(), 'Starting', 100);
});
