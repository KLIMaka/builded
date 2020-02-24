import { ArtFile, ArtFiles, createArts } from "../../../build/art";
import { createNewSector } from "../../../build/boardutils";
import { createPalette, GrpFile, loadShadeTables, loadPlus } from "../../../build/grp";
import { cloneBoard, loadBuildMap } from '../../../build/maploader';
import { Board, Sprite, SpriteStats } from "../../../build/structs";
import { Deck } from "../../../utils/collections";
import { createTexture } from "../../../utils/gl/textures";
import { Dependency, Injector } from "../../../utils/injector";
import { BoardManipulator_, BOARD, BuildReferenceTracker } from "../../apis/app";
import { ReferenceTrackerImpl } from "../../apis/referencetracker";
import { RAW_PAL } from "../artselector";
import { ArtFiles_, GL, ParallaxTextures_ } from "../buildartprovider";
import { PALSWAPS, PAL_TEXTURE, PLU_TEXTURE, SHADOWSTEPS } from "../gl/buildgl";
import { FS } from "../fs/fs";
import { MAP_NAMES, MapName_ } from "../selectmap";
import { Implementation_, RorLinks } from "../view/boardrenderer3d";

const GRP = new Dependency<GrpFile>('Grp File');
const SHADOW_TABLE = new Dependency<Uint8Array[]>('Shadow Table');
const LOOKUPS = new Dependency<Uint8Array[]>('Lookup Table');

async function loadArtFiles(injector: Injector): Promise<ArtFiles> {
  const grp = await injector.getInstance(GRP);
  const artFiles: ArtFile[] = [];
  for (let a = 0; a < 20; a++) artFiles.push(new ArtFile(grp.get('tiles0' + ("00" + a).slice(-2) + '.art')))
  return createArts(artFiles);
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
    injector.getInstance(LOOKUPS)]);

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
    const grp = await injector.getInstance(GRP);
    return loadBuildMap(grp.get(name));
  }
}

function createBoard() {
  const board = new Board();
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

  const sprite = new Sprite();
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
  const map = await injector.getInstance(MapName_);
  return !map ? createBoard() : loadMapImpl(map)(injector);
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
  const grp = await fs('DUKE3D.GRP');
  return new GrpFile(grp);
}

async function getMapNames(injector: Injector) {
  const grp = await injector.getInstance(GRP);
  return Object.keys(grp.files).filter(f => f.endsWith('.map'));
}

async function shadowsteps(injector: Injector) {
  const shadows = await injector.getInstance(SHADOW_TABLE);
  return shadows.length;
}

async function palswaps(injector: Injector) {
  const lookups = await injector.getInstance(LOOKUPS);
  return lookups.length;
}

export function DukeModule(injector: Injector) {
  injector.bindInstance(ParallaxTextures_, 5);
  injector.bindInstance(BoardManipulator_, { cloneBoard });
  injector.bindInstance(Implementation_, DukeImplementation());
  injector.bind(PALSWAPS, palswaps);
  injector.bind(SHADOWSTEPS, shadowsteps);
  injector.bind(GRP, loadGrp);
  injector.bind(ArtFiles_, loadArtFiles);
  injector.bind(RAW_PAL, loadPal);
  injector.bind(LOOKUPS, loadLookups);
  injector.bind(SHADOW_TABLE, loadShadowTable);
  injector.bind(PAL_TEXTURE, loadPalTexture);
  injector.bind(PLU_TEXTURE, loadPluTexture);
  injector.bind(MAP_NAMES, getMapNames);
  injector.bind(BOARD, loadMap);
}