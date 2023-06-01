import { UI } from "app/apis/ui";
import { VIEW_FACTORY as VIEW_FACTORY } from "app/modules/view/view";
import { LOGGER, LogLevel, TIMER } from './app/apis/app';
import { BloodModule } from './app/modules/blood/module';
import { GL, OFFSCREEN } from './app/modules/buildartprovider';
import { DefaultSetupModule } from './app/modules/context';
import { DefaultLifecycleListener } from './app/modules/default/lifecycle-listener';
import { DbFsModule } from './app/modules/fs/db';
import { FileBrowserModule } from './app/modules/fs/manager';
import { PhotonUiModule } from './app/modules/photonui';
import { App, getInstances, instance, plugin, provider } from './utils/injector';
import { BUS } from "app/apis/handler";

function createLogger() {
  return (level: LogLevel, ...msg: any[]) => {
    switch (level) {
      case 'ERROR': console.error(...msg); break;
      case 'WARN': console.warn(...msg); break;
      case 'INFO': console.info(...msg); break;
      case 'TRACE': console.trace(...msg); break;
      case 'DEBUG': console.debug(...msg); break;
    }
  }
}

const offscreenCanvas = new OffscreenCanvas(128, 128);
const gl = offscreenCanvas.getContext('webgl2', { alpha: true, antialias: true, stencil: true });
const logger = createLogger();
const timer = () => performance.now();

const app = new App(new DefaultLifecycleListener(timer, logger));
app.bind(LOGGER, instance(logger));
app.bind(TIMER, instance(timer));
app.bind(GL, instance(gl));
app.bind(OFFSCREEN, instance(offscreenCanvas));
app.install(DbFsModule('resources/engines/blood/'));
app.install(DefaultSetupModule);
app.install(BloodModule);
// module.install(DukeModule);
app.install(PhotonUiModule);
app.install(FileBrowserModule);
// app.install(ArtEditorModule);
// app.install(PainterModule);

app.bind(plugin('Main'), provider(async injector => {
  const [viewFactory, ui, bus] = await getInstances(injector, VIEW_FACTORY, UI, BUS);
  const view = viewFactory.create3d();
  const window = ui.createWindow('viewport', 400, 400);
  window.contentElement.appendChild(view.getCanvas());
  window.headerElement.innerText = 'Caption';
  window.addHandler(view);
  window.show();
  bus.connect(view);
}));

app.start();