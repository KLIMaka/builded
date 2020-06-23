import { cloneBoard, loadBloodMap, saveBloodMap } from '../../../build/blood/maploader';
import { BloodBoard } from '../../../build/blood/structs';
import { BloodImplementationConstructor } from '../../../build/blood/utils';
import { ArtFile, ArtFiles } from '../../../build/formats/art';
import { RffFile } from '../../../build/formats/rff';
import { createTexture } from '../../../utils/gl/textures';
import { Dependency, Injector } from '../../../utils/injector';
import { Stream } from '../../../utils/stream';
import { BoardManipulator_, BuildResources, DEFAULT_BOARD, RESOURCES, BOARD } from '../../apis/app';
import { BUS } from '../../apis/handler';
import { LoadBoard, namedMessageHandler } from '../../edit/messages';
import { RAW_PAL, PIC_TAGS } from '../artselector';
import { ART_FILES, GL, PARALLAX_TEXTURES } from '../buildartprovider';
import { FileSystem, FS } from '../fs/fs';
import { PALSWAPS, PAL_TEXTURE, PLU_TEXTURE, SHADOWSTEPS } from '../gl/buildgl';
import { MAP_NAMES, showMapSelection } from '../selectmap';
import { Implementation_ } from '../view/boardrenderer3d';
import { FS_MANAGER } from '../fs/manager';

export const RAW_PLUs = new Dependency<Uint8Array[]>('Raw PLUs');

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
  return new ArtFiles(arts);
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
  const [plus, gl, shadowsteps] = await Promise.all([
    injector.getInstance(RAW_PLUs),
    injector.getInstance(GL),
    injector.getInstance(SHADOWSTEPS)]);
  const tex = new Uint8Array(256 * shadowsteps * plus.length);
  let i = 0;
  for (const plu of plus) tex.set(plu, 256 * shadowsteps * i++);
  return createTexture(256, shadowsteps * plus.length, gl, { filter: gl.NEAREST }, tex, gl.LUMINANCE)
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
  board.numsprites = 0;
  board.version = 0x0700;
  board.posx = board.posy = board.posz = board.cursectnum = board.ang = 0;
  return board;
}

async function mapLoader(injector: Injector) {
  const bus = await injector.getInstance(BUS);
  bus.connect(namedMessageHandler('load_map', async () => {
    const mapName = await showMapSelection(injector);
    if (!mapName) return;
    const map = await loadMapImpl(mapName)(injector);
    bus.handle(new LoadBoard(map));
  }));
}

async function mapSaver(injector: Injector) {
  const bus = await injector.getInstance(BUS);
  const fsmgr = await injector.getInstance(FS_MANAGER);
  const board = await injector.getInstance(BOARD);
  bus.connect(namedMessageHandler('save_map', async () => {
    fsmgr.write('newboard.map', saveBloodMap(<BloodBoard>board()))
  }));
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
      const file = await fs.get(name);
      if (file != null) return file;
      return rfffs.get(name);
    },
    list: async () => {
      const files = new Set<string>(await rfffs.list());
      (await fs.list()).forEach(f => files.add(f));
      return [...files];
    }
  }
}

async function PicTags(injector: Injector) {
  const fs = await injector.getInstance(FS);
  const surface = new Uint8Array(await fs.get('SURFACE.DAT'));
  const tags = ['None', 'Stone', 'Metal', 'Wood', 'Flesh', 'Water', 'Dirt', 'Clay', 'Snow', 'Ice', 'Leaves', 'Cloth', 'Plant', 'Goo', 'Lava'];
  return {
    allTags() { return tags },
    tags(id: number) {
      if (surface.length <= id) return []
      return [tags[surface[id]]];
    }
  }
}

export function BloodModule(injector: Injector) {
  injector.bindInstance(PARALLAX_TEXTURES, 16);
  injector.bindInstance(BoardManipulator_, { cloneBoard });
  injector.bindInstance(SHADOWSTEPS, 64);
  injector.bind(RESOURCES, BloodResources);
  injector.bind(ART_FILES, loadArtFiles);
  injector.bind(RAW_PAL, loadPal);
  injector.bind(RAW_PLUs, loarRawPlus);
  injector.bind(PALSWAPS, loadPLUs);
  injector.bind(PAL_TEXTURE, loadPalTexture);
  injector.bind(PLU_TEXTURE, loadPluTexture);
  injector.bind(Implementation_, BloodImplementationConstructor);
  injector.bind(MAP_NAMES, getMapNames);
  injector.bind(PIC_TAGS, PicTags);
  injector.bindInstance(DEFAULT_BOARD, createBoard());

  injector.install(mapLoader);
  injector.install(mapSaver);
}