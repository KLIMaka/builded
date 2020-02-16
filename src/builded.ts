import { BuildContext_ } from './app/apis/app';
import { BloodModule, FS_ } from './app/modules/blood/filesystem';
import { MapName_, SelectMap } from './app/modules/blood/selectmap';
import { GL_ } from './app/modules/buildartprovider';
import { ContextModule } from './app/modules/context';
import { ZipFs } from './app/modules/zipfs';
import { animate, createContextFromCanvas } from './utils/gl/gl';
import { Injector } from './utils/injector';
import * as INPUT from './utils/input';
import { addLogAppender, CONSOLE } from './utils/logger';
import { loadBin } from './utils/getter';

document.body.oncontextmenu = () => false;
addLogAppender(CONSOLE);

const gl = createContextFromCanvas("display", { alpha: false, antialias: false, stencil: true });
INPUT.bind(<HTMLCanvasElement>gl.canvas);

const injector = new Injector();
injector.bindInstance(GL_, gl);
injector.bindInstance(FS_, f => loadBin('resources/engines/blood/' + f))
// injector.bind(FS_, ZipFs)
injector.bind(MapName_, SelectMap)
injector.install(ContextModule);
injector.install(BloodModule)

injector.getInstance(BuildContext_).then(context => {
  animate(gl, (gl: WebGLRenderingContext, time: number) => {
    context.frame(INPUT.get(), time);
    INPUT.postFrame();
  });
});

