import { BuildContext_ } from './app/apis/app';
import { BloodModule } from './app/modules/blood/module';
import { GL } from './app/modules/buildartprovider';
import { ContextModule } from './app/modules/context';
import { DbFsModule } from './app/modules/fs/db';
import { showFileBrowser } from './app/modules/fs/manager';
import { PhotonUiModule } from './app/modules/photonui';
import { MapName_, SelectMap } from './app/modules/selectmap';
import { animate, createContextFromCanvas } from './utils/gl/gl';
import { Injector } from './utils/injector';
import * as INPUT from './utils/input';
import { addLogAppender, CONSOLE } from './utils/logger';

document.body.oncontextmenu = () => false;
addLogAppender(CONSOLE);

const gl = createContextFromCanvas("display", { alpha: false, antialias: false, stencil: true });
INPUT.bind(<HTMLCanvasElement>gl.canvas);

const injector = new Injector();
injector.bindInstance(GL, gl);
injector.bind(MapName_, SelectMap);
injector.install(DbFsModule('resources/engines/blood/'));
injector.install(ContextModule);
injector.install(BloodModule);
injector.install(PhotonUiModule);

injector.getInstance(BuildContext_).then(context => {
  showFileBrowser(injector);
  animate(gl, (gl: WebGLRenderingContext, time: number) => {
    context.frame(INPUT.get(), time);
    INPUT.postFrame();
  });
});

