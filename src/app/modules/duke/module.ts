import { Board } from "../../../build/board/structs";
import { cloneBoard, cloneSector, cloneSprite, cloneWall, newBoard, newSector, newSprite, newWall, loadBuildMap, saveBuildMap } from '../../../build/maploader';
import { ArtFile, ArtFiles } from "../../../build/formats/art";
import { createPalette, GrpFile, loadPlus, loadShadeTables } from "../../../build/formats/grp";
import { createTexture } from "../../../utils/gl/textures";
import { Dependency, Injector, Module } from "../../../utils/injector";
import { BUS } from "../../apis/handler";
import { LoadBoard, namedMessageHandler } from "../../edit/messages";
import { PIC_TAGS, RAW_PAL, RAW_PLUs } from "../artselector";
import { ART_FILES, GL, PARALLAX_TEXTURES } from "../buildartprovider";
import { FS } from "../fs/fs";
import { PALSWAPS, PAL_TEXTURE, PLU_TEXTURE, SHADOWSTEPS } from "../gl/buildgl";
import { MAP_NAMES, showMapSelection } from "../selectmap";
import { Implementation_, RorLinks } from "../view/boardrenderer3d";
import { FS_MANAGER } from "../fs/manager";
import { EngineApi } from "../../../build/board/mutations/api";
import { BOARD, BuildResources, DEFAULT_BOARD, ENGINE_API, RESOURCES } from "../../apis/app";
import { Stream } from "../../../utils/stream";

const GRP = new Dependency<GrpFile>('Grp File');
const SHADOW_TABLE = new Dependency<Uint8Array[]>('Shadow Table');

async function loadArtFiles(injector: Injector): Promise<ArtFiles> {
  const grp = await injector.getInstance(GRP);
  const artFiles: ArtFile[] = [];
  for (let a = 0; a < 20; a++) artFiles.push(new ArtFile(grp.get('tiles0' + ("00" + a).slice(-2) + '.art')))
  return new ArtFiles(artFiles);
}

async function loadPal(injector: Injector) {
  const grp = await injector.getInstance(GRP);
  return createPalette(grp.get('PALETTE.DAT'));
}

async function loadPalTexture(injector: Injector) {
  return Promise.all([injector.getInstance(RAW_PAL), injector.getInstance(GL)]).then(
    ([pal, gl]) => createTexture(256, 1, gl, { filter: gl.NEAREST }, pal, gl.RGB, 3))
}

async function loadShadowTable(injector: Injector) {
  const grp = await injector.getInstance(GRP);
  return loadShadeTables(grp.get('PALETTE.DAT'));
}

async function loadLookups(injector: Injector) {
  const grp = await injector.getInstance(GRP);
  return loadPlus(grp.get('LOOKUP.DAT'));
}

async function loadPluTexture(injector: Injector) {
  const [shadows, gl, lookups] = await Promise.all([
    injector.getInstance(SHADOW_TABLE),
    injector.getInstance(GL),
    injector.getInstance(RAW_PLUs)]);

  const tex = new Uint8Array(256 * shadows.length * lookups.length);
  for (let i = 0; i < lookups.length; i++) {
    const lookup = lookups[i];
    const shadowed = new Uint8Array(256 * shadows.length);
    for (let s = 0; s < shadows.length; s++) {
      const shadow = shadows[s];
      for (let c = 0; c < 256; c++) shadowed[s * 256 + c] = shadow[lookup[c]]
    }
    tex.set(shadowed, 256 * shadows.length * i);
  }
  return createTexture(256, shadows.length * lookups.length, gl, { filter: gl.NEAREST }, tex, gl.LUMINANCE)
}

function loadMapImpl(name: string) {
  return async (injector: Injector) => {
    const res = await injector.getInstance(RESOURCES)
    return loadBuildMap(new Stream(await res.get(name), true));
  }
}

function createBoard() {
  const board = new Board();
  board.walls = [];
  board.sectors = [];
  board.sprites = [];
  board.numwalls = 0;
  board.numsectors = 0;
  board.numsprites = 0;
  board.version = 0x0007;
  board.posx = board.posy = board.posz = board.cursectnum = board.ang = 0;
  return board;
}

function DukeImplementation() {
  const rorLinks = new RorLinks();
  return {
    rorLinks: () => rorLinks,
    isMirrorPic(picnum: number) { return picnum == -1 },
  }
}

async function loadGrp(injector: Injector) {
  const fs = await injector.getInstance(FS);
  const grp = await fs.get('DUKE3D.GRP');
  return new GrpFile(grp);
}

async function getMapNames(injector: Injector) {
  const res = await injector.getInstance(RESOURCES);
  return () => res.list().then(list => list.filter(f => f.toLowerCase().endsWith('.map')));
}

async function shadowsteps(injector: Injector) {
  const shadows = await injector.getInstance(SHADOW_TABLE);
  return shadows.length;
}

async function palswaps(injector: Injector) {
  const lookups = await injector.getInstance(RAW_PLUs);
  return lookups.length;
}

async function PicTags(injector: Injector) {
  return {
    allTags() { return [] },
    tags(id: number) { return [] }
  }
}

async function Resources(injector: Injector): Promise<BuildResources> {
  const fs = await injector.getInstance(FS);
  const grp = await injector.getInstance(GRP);
  return {
    get: async name => {
      const file = await fs.get(name);
      if (file != null) return file;
      return grp.getArrayBuffer(name);
    },
    list: async () => {
      const files = new Set<string>(Object.keys(grp.files));
      (await fs.list()).forEach(f => files.add(f));
      return [...files];
    }
  }
}

async function mapLoader(module: Module) {
  module.execute(async injector => {
    const bus = await injector.getInstance(BUS);
    bus.connect(namedMessageHandler('load_map', async () => {
      const mapName = await showMapSelection(injector);
      if (!mapName) return;
      const map = await loadMapImpl(mapName)(injector);
      bus.handle(new LoadBoard(map));
    }));
  });
}

async function mapSaver(module: Module) {
  module.execute(async injector => {
    const bus = await injector.getInstance(BUS);
    const fsmgr = await injector.getInstance(FS_MANAGER);
    const board = await injector.getInstance(BOARD);
    bus.connect(namedMessageHandler('save_map', async () => {
      fsmgr.write('newboard.map', saveBuildMap(board()))
    }));
  });
}

function engineApi(): EngineApi {
  return { cloneBoard, cloneWall, cloneSprite, cloneSector, newWall, newSector, newSprite, newBoard };
}

export function DukeModule(module: Module) {
  module.bindInstance(PARALLAX_TEXTURES, 5);
  module.bindInstance(ENGINE_API, engineApi());
  module.bindInstance(Implementation_, DukeImplementation());
  module.bind(PALSWAPS, palswaps);
  module.bind(SHADOWSTEPS, shadowsteps);
  module.bind(GRP, loadGrp);
  module.bind(ART_FILES, loadArtFiles);
  module.bind(RAW_PAL, loadPal);
  module.bind<Uint8Array[]>(RAW_PLUs, loadLookups);
  module.bind<Uint8Array[]>(SHADOW_TABLE, loadShadowTable);
  module.bind(PAL_TEXTURE, loadPalTexture);
  module.bind(PLU_TEXTURE, loadPluTexture);
  module.bind(MAP_NAMES, getMapNames);
  module.bind(PIC_TAGS, PicTags);
  module.bindInstance(DEFAULT_BOARD, createBoard());
  module.bind(RESOURCES, Resources);

  module.install(mapLoader);
  module.install(mapSaver);
}