import { ArtFile, ArtFiles, createArts } from '../../../build/art';
import { cloneBoard, loadBloodMap } from '../../../build/blood/maploader';
import { BloodBoard, BloodSprite } from '../../../build/blood/structs';
import { BloodImplementationConstructor } from '../../../build/blood/utils';
import { createNewSector } from '../../../build/boardutils';
import { RffFile } from '../../../build/rff';
import { SpriteStats } from '../../../build/structs';
import { Deck } from '../../../utils/collections';
import { createTexture } from '../../../utils/gl/textures';
import { Dependency, Injector } from '../../../utils/injector';
import { Stream } from '../../../utils/stream';
import { BoardManipulator_, Board_, BuildReferenceTracker } from '../../apis/app';
import { ReferenceTrackerImpl } from '../../apis/referencetracker';
import { RAW_PAL_ } from '../artselector';
import { ArtFiles_, GL, ParallaxTextures_ } from '../buildartprovider';
import { Palswaps_, PAL_, PLUs_, Shadowsteps_ } from '../gl/buildgl';
import { Implementation_ } from '../view/boardrenderer3d';
import { MapName_, MapNames_ } from '../selectmap';
import { FS, FileSystem } from '../fs/fs';
import { MOUNTS } from '../fs/mount';

const RAW_PLUs_ = new Dependency<Uint8Array[]>('Raw PLUs');

async function loadArtFiles(injector: Injector): Promise<ArtFiles> {
  const fs = await injector.getInstance(FS);
  const artPromises: Promise<ArtFile>[] = [];
  for (let a = 0; a < 18; a++) artPromises.push(fs.get('TILES0' + ("00" + a).slice(-2) + '.ART').then(file => new ArtFile(new Stream(file, true))))
  const artFiles = await Promise.all(artPromises);
  return createArts(artFiles);
}

async function loadPLUs(injector: Injector) {
  return (await injector.getInstance(RAW_PLUs_)).length;
}

async function loadPalTexture(injector: Injector) {
  const [pal, gl] = await Promise.all([injector.getInstance(RAW_PAL_), injector.getInstance(GL)]);
  return createTexture(256, 1, gl, { filter: gl.NEAREST }, pal, gl.RGB, 3);
}

async function loarRawPlus(injector: Injector) {
  const fs = await injector.getInstance(FS)
  const plus = await Promise.all([
    fs.get('NORMAL.PLU'),
    fs.get('SATURATE.PLU'),
    fs.get('BEAST.PLU'),
    fs.get('TOMMY.PLU'),
    fs.get('SPIDER3.PLU'),
    fs.get('GRAY.PLU'),
    fs.get('GRAYISH.PLU'),
    fs.get('SPIDER1.PLU'),
    fs.get('SPIDER2.PLU'),
    fs.get('FLAME.PLU'),
    fs.get('COLD.PLU'),
    fs.get('P1.PLU'),
    fs.get('P2.PLU'),
    fs.get('P3.PLU'),
    fs.get('P4.PLU'),
  ]);
  return plus.map(p => new Uint8Array(p));
}

async function loadPluTexture(injector: Injector) {
  return Promise.all([
    injector.getInstance(RAW_PLUs_),
    injector.getInstance(GL),
    injector.getInstance(Shadowsteps_)])
    .then(([plus, gl, shadowsteps]) => {
      const tex = new Uint8Array(256 * shadowsteps * plus.length);
      let i = 0;
      for (const plu of plus) tex.set(plu, 256 * shadowsteps * i++);
      return createTexture(256, shadowsteps * plus.length, gl, { filter: gl.NEAREST }, tex, gl.LUMINANCE)
    })
}

function loadMapImpl(name: string) {
  return async (injector: Injector) => {
    const fs = await injector.getInstance(FS)
    return loadBloodMap(new Stream(await fs.get(name), true));
  }
}

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

  board.sectors[0].floorz = 0;
  board.sectors[0].ceilingz = -16 * 4096;

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

async function loadMap(injector: Injector) {
  const map = await injector.getInstance(MapName_)
  return !map ? createBoard() : loadMapImpl(map)(injector);
}

async function getMapNames(injector: Injector) {
  const fs = await injector.getInstance(FS);
  return (await fs.list()).filter(f => f.endsWith('.map'));
}

let rff: RffFile;
async function loadRffFile(injector: Injector) {
  if (rff == null) {
    rff = new RffFile(await (await injector.getInstance(FS)).get('BLOOD.RFF'));
  }
  return rff;
}

async function loadRff(injector: Injector): Promise<FileSystem> {
  return {
    get: async name => (await loadRffFile(injector)).get(name).buffer,
    list: async () => (await loadRffFile(injector)).fat.map(r => r.filename),
    info: async name => {
      const rff = await loadRffFile(injector);
      const file = rff.get(name);
      return file ? { name: name, size: file.byteLength, source: "BLOOD.RFF" } : null;
    }
  }
}

function loadFile(name: string) {
  return async (injector: Injector) => {
    const fs = await injector.getInstance(FS);
    return new Uint8Array(await fs.get(name));
  }
}

export function BloodModule(injector: Injector) {
  injector.bindInstance(ParallaxTextures_, 16);
  injector.bindInstance(BoardManipulator_, { cloneBoard });
  injector.bindInstance(Shadowsteps_, 64);
  injector.bindMulti(MOUNTS, loadRff);
  injector.bind(ArtFiles_, loadArtFiles);
  injector.bind(RAW_PAL_, loadFile('BLOOD.PAL'));
  injector.bind(RAW_PLUs_, loarRawPlus);
  injector.bind(Palswaps_, loadPLUs);
  injector.bind(PAL_, loadPalTexture);
  injector.bind(PLUs_, loadPluTexture);
  injector.bind(Implementation_, BloodImplementationConstructor);
  injector.bind(MapNames_, getMapNames);
  injector.bind(Board_, loadMap);
}