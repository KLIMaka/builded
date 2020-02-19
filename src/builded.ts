import { BuildContext_, Storages_ } from './app/apis/app';
import { BloodModule } from './app/modules/blood/module';
import { GL } from './app/modules/buildartprovider';
import { ContextModule } from './app/modules/context';
// import { DukeModule } from './app/modules/duke/module';
import { StorageDbConstructor } from './app/modules/db';
import { DbFsModule } from './app/modules/fs/db';
import { FS, UrlFs, FileSystem } from './app/modules/fs/fs';
import { showFileBrowser } from './app/modules/fs/manager';
import { MountableFs, MOUNTS } from './app/modules/fs/mount';
import { MapName_, SelectMap } from './app/modules/selectmap';
import { PhotonUiModule } from './app/modules/photonui';
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
injector.bind(FS, MountableFs);
injector.bind(Storages_, StorageDbConstructor);
injector.bind(MapName_, SelectMap);
injector.install(DbFsModule);
injector.bind<FileSystem>(MOUNTS, UrlFs('resources/engines/blood/'));
injector.install(ContextModule);
injector.install(BloodModule);
injector.install(PhotonUiModule);
// injector.install(DukeModule);

injector.getInstance(BuildContext_).then(context => {
  showFileBrowser(injector);
  animate(gl, (gl: WebGLRenderingContext, time: number) => {
    context.frame(INPUT.get(), time);
    INPUT.postFrame();
  });
});

