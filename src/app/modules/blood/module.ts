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
import { BoardManipulator_, BuildReferenceTracker, BuildResources, RESOURCES, DEFAULT_BOARD } from '../../apis/app';
import { BUS, MessageHandlerReflective } from '../../apis/handler';
import { ReferenceTrackerImpl } from '../../apis/referencetracker';
import { LoadBoard, NamedMessage } from '../../edit/messages';
import { RAW_PAL } from '../artselector';
import { ArtFiles_, GL, ParallaxTextures_ } from '../buildartprovider';
import { FileSystem, FS } from '../fs/fs';
import { PALSWAPS, PAL_TEXTURE, PLU_TEXTURE, SHADOWSTEPS } from '../gl/buildgl';
import { MAP_NAMES, showMapSelection } from '../selectmap';
import { Implementation_ } from '../view/boardrenderer3d';

const RAW_PLUs = new Dependency<Uint8Array[]>('Raw PLUs');

async function loadArtFiles(injector: Injector): Promise<ArtFiles> {
  const res = await injector.getInstance(RESOURCES);
  const arts: ArtFile[] = [];
  for (let a = 0; a < 100; a++) {
    const name = 'TILES0' + ("00" + a).slice(-2) + '.ART';
    const file = await res.get(name);
    if (file) arts.push(new ArtFile(new Stream(file, true)));
    else break;
  }
  if (arts.length == 0) throw new Error('No ART files was loaded');
  return createArts(arts);
}

async function loadPLUs(injector: Injector) {
  return (await injector.getInstance(RAW_PLUs)).length;
}

async function loadPalTexture(injector: Injector) {
  const [pal, gl] = await Promise.all([injector.getInstance(RAW_PAL), injector.getInstance(GL)]);
  return createTexture(256, 1, gl, { filter: gl.NEAREST }, pal, gl.RGB, 3);
}

async function loarRawPlus(injector: Injector) {
  const res = await injector.getInstance(RESOURCES)
  const plus = await Promise.all([
    res.get('NORMAL.PLU'),
    res.get('SATURATE.PLU'),
    res.get('BEAST.PLU'),
    res.get('TOMMY.PLU'),
    res.get('SPIDER3.PLU'),
    res.get('GRAY.PLU'),
    res.get('GRAYISH.PLU'),
    res.get('SPIDER1.PLU'),
    res.get('SPIDER2.PLU'),
    res.get('FLAME.PLU'),
    res.get('COLD.PLU'),
    res.get('P1.PLU'),
    res.get('P2.PLU'),
    res.get('P3.PLU'),
    res.get('P4.PLU'),
  ]);
  return plus.filter(p => p != null).map(p => new Uint8Array(p));
}

async function loadPluTexture(injector: Injector) {
  return Promise.all([
    injector.getInstance(RAW_PLUs),
    injector.getInstance(GL),
    injector.getInstance(SHADOWSTEPS)])
    .then(([plus, gl, shadowsteps]) => {
      const tex = new Uint8Array(256 * shadowsteps * plus.length);
      let i = 0;
      for (const plu of plus) tex.set(plu, 256 * shadowsteps * i++);
      return createTexture(256, shadowsteps * plus.length, gl, { filter: gl.NEAREST }, tex, gl.LUMINANCE)
    })
}

function loadMapImpl(name: string) {
  return async (injector: Injector) => {
    const res = await injector.getInstance(RESOURCES)
    return loadBloodMap(new Stream(await res.get(name), true));
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

async function mapLoader(injector: Injector) {
  const bus = await injector.getInstance(BUS);
  bus.connect(new class extends MessageHandlerReflective {
    async NamedMessage(msg: NamedMessage) {
      if (msg.name == 'load_map') {
        const mapName = await showMapSelection(injector);
        if (!mapName) return;
        const map = await loadMapImpl(mapName)(injector);
        bus.handle(new LoadBoard(map));
      }
    }
  });
}

async function getMapNames(injector: Injector) {
  const res = await injector.getInstance(RESOURCES);
  return () => res.list().then(list => list.filter(f => f.toLowerCase().endsWith('.map')));
}

async function loadRffFile(injector: Injector) {
  const fs = await injector.getInstance(FS);
  const rffFile = await fs.get('BLOOD.RFF');
  if (rffFile) return new RffFile(rffFile);
  return null;
}

async function loadRffFs(injector: Injector): Promise<FileSystem> {
  const rff = await loadRffFile(injector)
  return rff
    ? {
      get: async name => { const file = rff.get(name); return file ? file.buffer : null },
      list: async () => rff.fat.map(r => r.filename),
    }
    : {
      get: async name => null,
      list: async () => []
    }
}

async function loadPal(injector: Injector) {
  const res = await injector.getInstance(RESOURCES);
  return new Uint8Array(await res.get('BLOOD.PAL'));
}

async function BloodResources(injector: Injector): Promise<BuildResources> {
  const fs = await injector.getInstance(FS);
  const rfffs = await loadRffFs(injector);
  return {
    get: async name => {
      const file = await rfffs.get(name);
      if (file) return file;
      return fs.get(name);
    },
    list: async () => {
      const files = new Set<string>(await rfffs.list());
      (await fs.list()).forEach(f => files.add(f));
      return [...files];
    }
  }
}

export function BloodModule(injector: Injector) {
  injector.bindInstance(ParallaxTextures_, 16);
  injector.bindInstance(BoardManipulator_, { cloneBoard });
  injector.bindInstance(SHADOWSTEPS, 64);
  injector.bind(RESOURCES, BloodResources);
  injector.bind(ArtFiles_, loadArtFiles);
  injector.bind(RAW_PAL, loadPal);
  injector.bind(RAW_PLUs, loarRawPlus);
  injector.bind(PALSWAPS, loadPLUs);
  injector.bind(PAL_TEXTURE, loadPalTexture);
  injector.bind(PLU_TEXTURE, loadPluTexture);
  injector.bind(Implementation_, BloodImplementationConstructor);
  injector.bind(MAP_NAMES, getMapNames);
  injector.bindInstance(DEFAULT_BOARD, createBoard());

  injector.install(mapLoader);
}