import { BloodModule } from './app/modules/blood/module';
import { DukeModule } from './app/modules/duke/module';
import { GL } from './app/modules/buildartprovider';
import { DefaultSetupModule, MainLoopConstructor } from './app/modules/context';
import { DbFsModule } from './app/modules/fs/db';
import { FileBrowserModule } from './app/modules/fs/manager';
import { ArtEditorModule } from './app/modules/arteditor';
import { PhotonUiModule } from './app/modules/photonui';
import { animate, createContextFromCanvas } from './utils/gl/gl';
import { Injector } from './utils/injector';
import * as INPUT from './utils/input';
import { addLogAppender, CONSOLE } from './utils/logger';

addLogAppender(CONSOLE);
const gl = createContextFromCanvas("display", { alpha: false, antialias: true, stencil: true });
INPUT.bind(<HTMLCanvasElement>gl.canvas);

const injector = new Injector();
injector.bindInstance(GL, gl);
injector.install(DbFsModule('resources/engines/blood/'));
injector.install(DefaultSetupModule);
// injector.install(BloodModule);
injector.install(DukeModule);
injector.install(PhotonUiModule);
injector.install(FileBrowserModule);
injector.install(ArtEditorModule);

MainLoopConstructor(injector).then(mainLoop => {
  animate(gl, (gl: WebGLRenderingContext, time: number) => {
    mainLoop.frame(INPUT.get(), time);
    INPUT.postFrame();
  });
});

