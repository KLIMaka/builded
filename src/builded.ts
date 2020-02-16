import { getQueryVariable } from './libs/browser';
import { preload, preloadString } from './libs/getter';
import { loadImage } from './libs/imgutils';
import { Dependency, Injector } from './libs/injector';
import { Stream } from './libs/stream';
import { Deck, map } from './modules/collections';
import { Texture } from './modules/drawstruct';
import { ArtProvider_, BoardManipulator_, Board_, BuildContext_, BuildReferenceTracker, View_ } from './modules/engines/build/api';
import * as ART from './modules/engines/build/art';
import { ArtFiles } from './modules/engines/build/art';
import { RAW_PAL_, SelectorConstructor } from './modules/engines/build/artselector';
import { cloneBoard, loadBloodMap } from './modules/engines/build/bloodloader';
import { BloodBoard, BloodSprite } from './modules/engines/build/bloodstructs';
import { BloodImplementationConstructor } from './modules/engines/build/bloodutils';
import { createNewSector } from './modules/engines/build/boardutils';
import { ArtFiles_, BuildArtProviderConstructor, GL_, UtilityTextures_ } from './modules/engines/build/buildartprovider';
import { PicNumSelector_ } from './modules/engines/build/edit/tools/selection';
import { Implementation_ } from './modules/engines/build/gl/boardrenderer3d';
import { BuildGlConstructor, BuildGl_, Palswaps_, PAL_, PLUs_, Shadowsteps_ } from './modules/engines/build/gl/buildgl';
import { RenderablesCacheImpl, RenderablesCache_ } from './modules/engines/build/gl/cache';
import { ContextModule, KeymapConfig_ } from './modules/engines/build/gl/context';
import { ReferenceTrackerImpl } from './modules/engines/build/referencetracker';
import * as RFF from './modules/engines/build/rff';
import { SpriteStats } from './modules/engines/build/structs';
import { SwappableViewConstructor } from './modules/engines/build/view';
import { animate, createContextFromCanvas } from './modules/gl';
import * as INPUT from './modules/input';
import { addLogAppender, CONSOLE } from './modules/logger';
import { createTexture } from './modules/textures';


function createBoard() {
  const board = new BloodBoard();
  board.walls = [];
  board.sectors = [];
  board.sprites = [];
  board.numwalls = 0;
  board.numsectors = 0;
  board.numsprites = 1;

  const points = new Deck<[number, number]>();

  const NULL_TRACKER: BuildReferenceTracker = {
    walls: new ReferenceTrackerImpl<number>(-1),
    sectors: new ReferenceTrackerImpl<number>(-1),
    sprites: new ReferenceTrackerImpl<number>(-1),
  }

  createNewSector(board, points.clear()
    .push([0, 0])
    .push([4096, 0])
    .push([4096, 4096])
    .push([0, 4096]),
    NULL_TRACKER
  );
  // createInnerLoop(board, 0, points.clear()
  //   .push([1024, 1024])
  //   .push([1024, 3072])
  //   .push([3072, 3072])
  //   .push([3072, 1024])
  // );
  // createNewSector(board, points.clear()
  //   .push([1024, 1024])
  //   .push([1024, 3072])
  //   .push([3072, 3072])
  //   .push([3072, 1024])
  // );

  board.sectors[0].floorz = 0;
  board.sectors[0].ceilingz = -16 * 4096;
  // board.sectors[1].floorz = -16 * 1024;
  // board.sectors[1].ceilingz = -16 * 3072;

  const sprite = new BloodSprite();
  sprite.x = 1024;
  sprite.y = 1024;
  sprite.z = 0;
  sprite.picnum = 0;
  sprite.lotag = 1;
  sprite.sectnum = 0;
  sprite.cstat = new SpriteStats();
  sprite.extra = 65535;
  board.sprites.push(sprite);
  return board;
}

async function loadTexture(gl: WebGLRenderingContext, name: string, options: any = {}, format = gl.RGBA, bpp = 4) {
  return loadImage(name).then(img => createTexture(img[0], img[1], gl, options, img[2], format, bpp))
}

async function loadUtilityTextures(textures: [number, Promise<Texture>][]) {
  return Promise.all(map(textures, t => t[1])).then(
    _ => {
      const result: { [index: number]: Texture } = {};
      for (const t of textures) t[1].then(tex => result[t[0]] = tex);
      return result;
    }
  )
}

async function loadArtFiles(): Promise<ArtFiles> {
  const path = 'resources/engines/blood/';
  const artPromises: Promise<ART.ArtFile>[] = [];
  for (let a = 0; a < 18; a++)     artPromises.push(preload(path + 'TILES0' + ("00" + a).slice(-2) + '.ART').then(file => ART.create(new Stream(file, true))))
  return Promise.all(artPromises).then(artFiles => ART.createArts(artFiles))
}

const RFF_ = new Dependency<RFF.RffFile>('RFF File');
const RAW_PLUs_ = new Dependency<Uint8Array[]>('Raw PLUs');

function loadRffFile(name: string): (injector: Injector) => Promise<Uint8Array> {
  return (injector: Injector) => new Promise<Uint8Array>(resolve => injector.getInstance(RFF_).then(rff => resolve(rff.get(name))))
}

async function loadPLUs(injector: Injector) {
  return injector.getInstance(RAW_PLUs_).then(plus => plus.length)
}

async function loadPalTexture(injector: Injector) {
  return Promise.all([injector.getInstance(RAW_PAL_), injector.getInstance(GL_)]).then(([pal, gl]) => createTexture(256, 1, gl, { filter: gl.NEAREST }, pal, gl.RGB, 3))
}

async function loadPluTexture(injector: Injector) {
  return Promise.all([
    injector.getInstance(RAW_PLUs_),
    injector.getInstance(GL_),
    injector.getInstance(Shadowsteps_)])
    .then(([plus, gl, shadowsteps]) => {
      const tex = new Uint8Array(256 * shadowsteps * plus.length);
      let i = 0;
      for (const plu of plus) tex.set(plu, 256 * shadowsteps * i++);
      return createTexture(256, shadowsteps * plus.length, gl, { filter: gl.NEAREST }, tex, gl.LUMINANCE)
    })
}


async function loarRawPlus(injector: Injector) {
  return injector.getInstance(RFF_).then(rff => [
    rff.get('NORMAL.PLU'),
    rff.get('SATURATE.PLU'),
    rff.get('BEAST.PLU'),
    rff.get('TOMMY.PLU'),
    rff.get('SPIDER3.PLU'),
    rff.get('GRAY.PLU'),
    rff.get('GRAYISH.PLU'),
    rff.get('SPIDER1.PLU'),
    rff.get('SPIDER2.PLU'),
    rff.get('FLAME.PLU'),
    rff.get('COLD.PLU'),
    rff.get('P1.PLU'),
    rff.get('P2.PLU'),
    rff.get('P3.PLU'),
    rff.get('P4.PLU'),
  ])
}

function loadMap(name: string) { return async (injector: Injector) => injector.getInstance(RFF_).then(rff => loadBloodMap(new Stream(rff.get(name).buffer, true))) }

document.body.oncontextmenu = () => false;
addLogAppender(CONSOLE);

const gl = createContextFromCanvas("display", { alpha: false, antialias: false, stencil: true });
INPUT.bind(<HTMLCanvasElement>gl.canvas);

const injector = new Injector();
injector.bindInstance(BoardManipulator_, { cloneBoard });
injector.bindInstance(RenderablesCache_, new RenderablesCacheImpl());
injector.bindInstance(Shadowsteps_, 64);
injector.bindInstance(GL_, gl);
injector.bindPromise(RFF_, preload('/resources/engines/blood/BLOOD.RFF').then(rff => RFF.create(rff)))
injector.bindPromise(ArtFiles_, loadArtFiles());
injector.bindPromise(KeymapConfig_, preloadString('builded_binds.txt'));
injector.bindPromise(UtilityTextures_, loadUtilityTextures([
  [-1, loadTexture(gl, 'resources/point1.png', { filter: gl.NEAREST, repeat: gl.CLAMP_TO_EDGE })],
  [-2, loadTexture(gl, 'resources/img/font.png', { filter: gl.NEAREST, repeat: gl.CLAMP_TO_EDGE })],
  [-3, loadTexture(gl, 'resources/grid.png', { filter: gl.LINEAR_MIPMAP_LINEAR, repeat: gl.REPEAT, aniso: true })],
]));
injector.bind(RAW_PAL_, loadRffFile('BLOOD.PAL'));
injector.bind(RAW_PLUs_, loarRawPlus);
injector.bind(Palswaps_, loadPLUs);
injector.bind(PAL_, loadPalTexture);
injector.bind(PLUs_, loadPluTexture);
injector.bind(ArtProvider_, BuildArtProviderConstructor);
injector.bind(PicNumSelector_, SelectorConstructor);
injector.bind(View_, SwappableViewConstructor);
injector.bind(Implementation_, BloodImplementationConstructor);
injector.bind(BuildGl_, BuildGlConstructor);
injector.bind(Board_, loadMap(getQueryVariable('map')));
// injector.bindInstance(Board_, Promise.resolve(createBoard()));
injector.install(ContextModule);

injector.getInstance(BuildContext_).then(context => {
  animate(gl, (gl: WebGLRenderingContext, time: number) => {
    context.frame(INPUT.get(), time);
    INPUT.postFrame();
  });
});

