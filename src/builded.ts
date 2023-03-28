import { UI } from "app/apis/ui";
import { ViewType, VIEW_CONTROLLER } from "app/modules/view/view";
import $ from "jquery";
import "jqueryui";
import { LOGGER, LogLevel, TIMER } from './app/apis/app';
import { ArtEditorModule } from './app/modules/arteditor';
import { BloodModule } from './app/modules/blood/module';
import { GL, OFFSCREEN } from './app/modules/buildartprovider';
import { DefaultSetupModule } from './app/modules/context';
import { InputModule } from './app/modules/default/input';
import { DefaultLifecycleListener } from './app/modules/default/lifecycle-listener';
import { DbFsModule } from './app/modules/fs/db';
import { FileBrowserModule } from './app/modules/fs/manager';
import { PainterModule } from './app/modules/painter/painter';
import { PhotonUiModule } from './app/modules/photonui';
import { App, getInstances, instance, plugin, provider } from './utils/injector';

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
app.install(InputModule);
app.install(DbFsModule('resources/engines/blood/'));
app.install(DefaultSetupModule);
app.install(BloodModule);
// module.install(DukeModule);
app.install(PhotonUiModule);
app.install(FileBrowserModule);
app.install(ArtEditorModule);
app.install(PainterModule);

app.bind(plugin('MainLoop'), provider(async injector => {
  const [viewctl, ui] = await getInstances(injector, VIEW_CONTROLLER, UI);
  const canvas = document.createElement('canvas');
  viewctl.add(canvas, ViewType.VIEW_3D);
  const window = ui.builder.window()
    .title('Viewport')
    .draggable(true)
    .size(600, 600)
    .content(canvas)
    .build();
  window.show();
}));

app.start();