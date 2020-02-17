import { BuildContext_ } from './app/apis/app';
import { BloodModule, } from './app/modules/blood/module';
import { MapName_, SelectMap } from './app/modules/selectmap';
import { GL_ } from './app/modules/buildartprovider';
import { ContextModule } from './app/modules/context';
import { UrlFs, ZipFs, FS_ } from './app/modules/fs';
import { animate, createContextFromCanvas } from './utils/gl/gl';
import { Injector } from './utils/injector';
import * as INPUT from './utils/input';
import { addLogAppender, CONSOLE } from './utils/logger';
import { DukeModule } from './app/modules/duke/module';

document.body.oncontextmenu = () => false;
addLogAppender(CONSOLE);

const gl = createContextFromCanvas("display", { alpha: false, antialias: false, stencil: true });
INPUT.bind(<HTMLCanvasElement>gl.canvas);

const injector = new Injector();
injector.bindInstance(GL_, gl);
injector.bindPromise(FS_, UrlFs('resources/engines/blood/'))
// injector.bindPromise(FS_, ZipFs())
injector.bind(MapName_, SelectMap)
injector.install(ContextModule);
// injector.install(BloodModule)
injector.install(DukeModule)

injector.getInstance(BuildContext_).then(context => {
  animate(gl, (gl: WebGLRenderingContext, time: number) => {
    context.frame(INPUT.get(), time);
    INPUT.postFrame();
  });
});

