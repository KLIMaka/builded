import { LOGGER, LogLevel, TIMER, VIEW } from './app/apis/app';
import { BUS } from './app/apis/handler';
import { ArtEditorModule } from './app/modules/arteditor';
import { BloodModule } from './app/modules/blood/module';
import { GL } from './app/modules/buildartprovider';
import { DefaultSetupModule, MainLoop } from './app/modules/context';
import { FRAME_GENERATOR } from './app/modules/default/framegenerator';
import { InputModule } from './app/modules/default/input';
import { DbFsModule } from './app/modules/fs/db';
import { FileBrowserModule } from './app/modules/fs/manager';
import { PainterModule } from './app/modules/painter/painter';
import { PhotonUiModule } from './app/modules/photonui';
import { createContextFromCanvas } from './utils/gl/gl';
import { App, create, instance, plugin, provider } from './utils/injector';
import { PROFILER } from './utils/profiler';
import { DefaultLifecycleListener } from './app/modules/default/lifecycle-listener';
import $ from "jquery";
import "jqueryui";

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

const gl = createContextFromCanvas("display", { alpha: false, antialias: true, stencil: true });
const logger = createLogger();
const timer = () => performance.now();
const app = new App(new DefaultLifecycleListener(timer, logger));
app.bind(LOGGER, instance(logger));
app.bind(TIMER, instance(timer));
app.bind(GL, instance(gl));
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
  await create(injector, MainLoop, GL, VIEW, BUS, PROFILER, FRAME_GENERATOR);
}));

$("#viewport").resizable({ containment: 'body' }).draggable({ containment: 'body' })


app.start();