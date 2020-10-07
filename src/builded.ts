import { BloodModule } from './app/modules/blood/module';
import { DukeModule } from './app/modules/duke/module';
import { GL } from './app/modules/buildartprovider';
import { DefaultSetupModule, MainLoopConstructor } from './app/modules/context';
import { DbFsModule } from './app/modules/fs/db';
import { FileBrowserModule } from './app/modules/fs/manager';
import { ArtEditorModule } from './app/modules/arteditor';
import { PhotonUiModule } from './app/modules/photonui';
import { animate, createContextFromCanvas } from './utils/gl/gl';
import { RootModule } from './utils/injector';
import * as INPUT from './utils/input';
import { addLogAppender, CONSOLE } from './utils/logger';

addLogAppender(CONSOLE);
const gl = createContextFromCanvas("display", { alpha: false, antialias: true, stencil: true });
INPUT.bind(<HTMLCanvasElement>gl.canvas);

const module = new RootModule();
module.bindInstance(GL, gl);
module.install(DbFsModule('resources/engines/blood/'));
module.install(DefaultSetupModule);
module.install(BloodModule);
// injector.install(DukeModule);
module.install(PhotonUiModule);
module.install(FileBrowserModule);
module.install(ArtEditorModule);
module.execute(async injector => {
  MainLoopConstructor(injector).then(mainLoop => {
    animate(gl, (gl: WebGLRenderingContext, time: number) => {
      mainLoop.frame(INPUT.get(), time);
      INPUT.postFrame();
    });
  });
});
module.start();


