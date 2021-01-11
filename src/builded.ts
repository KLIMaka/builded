import { BloodModule } from './app/modules/blood/module';
import { DukeModule } from './app/modules/duke/module';
import { GL } from './app/modules/buildartprovider';
import { DefaultSetupModule, MainLoopConstructor } from './app/modules/context';
import { DbFsModule } from './app/modules/fs/db';
import { FileBrowserModule } from './app/modules/fs/manager';
import { ArtEditorModule } from './app/modules/arteditor';
import { PhotonUiModule } from './app/modules/photonui';
import { animate, createContextFromCanvas } from './utils/gl/gl';
import { App, instance, plugin, provider } from './utils/injector';
import { addLogAppender, CONSOLE } from './utils/logger';
import { InputModule } from './app/modules/input';

addLogAppender(CONSOLE);
const gl = createContextFromCanvas("display", { alpha: false, antialias: true, stencil: true });

const app = new App();
app.bind(GL, instance(gl));
app.install(InputModule);
app.install(DbFsModule('resources/engines/blood/'));
app.install(DefaultSetupModule);
app.install(BloodModule);
// module.install(DukeModule);
app.install(PhotonUiModule);
app.install(FileBrowserModule);
app.install(ArtEditorModule);
app.bind(plugin('MainLoop'), provider(async injector => {
  MainLoopConstructor(injector).then(mainLoop => {
    animate(gl, (gl: WebGLRenderingContext, time: number) => {
      mainLoop.frame(time);
    });
  });
}));
app.start();


