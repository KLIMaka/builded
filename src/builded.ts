import { DefaultApp } from "./app/modules/default/app/app";
import { DefaultFileSystems, storageFS } from "./app/modules/default/app/fs";
import { DefaultLifecycleListener } from "./app/modules/default/lifecycle-listener";
import { App as AppInjector, instance, provider } from "./utils/injector";
import { FS } from "./app/apis/fs";
import { App } from "./app/apis/app1";

const app = DefaultApp("App");

app.scheduler.exec(async handler => {

  const appInjector = new AppInjector(new DefaultLifecycleListener(app.timer, app.logger));
  appInjector.bind(FS, provider(i => createFs(app)));

  async function createFs(app: App) {
    const fs = DefaultFileSystems();
    const storage = await handler.waitFor(app.storages("root"));
    fs.mount("Storage", storageFS(storage));
    return fs;
  }

})