import { ArtFile, createArts, ArtFiles } from "../../../build/art";
import { BloodImplementationConstructor } from "../../../build/blood/utils";
import { GrpFile, createPalette, loadShadeTables } from "../../../build/grp";
import { cloneBoard, loadBuildMap } from '../../../build/maploader';
import { Dependency, Injector } from "../../../utils/injector";
import { BoardManipulator_, Board_, BuildReferenceTracker } from "../../apis/app";
import { RAW_PAL_ } from "../artselector";
import { ArtFiles_, GL_ } from "../buildartprovider";
import { Palswaps_, PAL_, PLUs_, Shadowsteps_ } from "../buildgl";
import { FS_ } from "../fs";
import { Implementation_, RorLinks } from "../view/boardrenderer3d";
import { createTexture } from "../../../utils/gl/textures";
import { MapName_, MapNames_ } from "../blood/selectmap";
import { Board, SpriteStats, Sprite } from "../../../build/structs";
import { Deck } from "../../../utils/collections";
import { ReferenceTrackerImpl } from "../../apis/referencetracker";
import { createNewSector } from "../../../build/boardutils";

const GRP_ = new Dependency<GrpFile>('Grp File');
const RAW_PLUs_ = new Dependency<Uint8Array[]>('Raw PLUs');

async function loadArtFiles(injector: Injector): Promise<ArtFiles> {
  return injector.getInstance(GRP_).then(async grp => {
    const artFiles: ArtFile[] = [];
    for (let a = 0; a < 20; a++) artFiles.push(new ArtFile(grp.get('tiles0' + ("00" + a).slice(-2) + '.art')))
    return createArts(artFiles);
  })
}

async function loadPal(injector: Injector) {
  const grp = await injector.getInstance(GRP_);
  return createPalette(grp.get('PALETTE.DAT'));
}

async function loadPalTexture(injector: Injector) {
  return Promise.all([injector.getInstance(RAW_PAL_), injector.getInstance(GL_)]).then(([pal, gl]) => createTexture(256, 1, gl, { filter: gl.NEAREST }, pal, gl.RGB, 3))
}

async function loadRawPlus(injector: Injector) {
  const grp = await injector.getInstance(GRP_);
  return loadShadeTables(grp.get('PALETTE.DAT'));
}

async function loadPluTexture(injector: Injector) {
  return Promise.all([
    injector.getInstance(RAW_PLUs_),
    injector.getInstance(GL_),
    injector.getInstance(Shadowsteps_)])
    .then(([plus, gl, shadowsteps]) => {
      const tex = new Uint8Array(256 * plus.length);
      let i = 0;
      for (const plu of plus) tex.set(plu, 256 * i++);
      return createTexture(256, plus.length, gl, { filter: gl.NEAREST }, tex, gl.LUMINANCE)
    })
}

function loadMapImpl(name: string) {
  return async (injector: Injector) => injector.getInstance(GRP_).then(grp => loadBuildMap(grp.get(name)))
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
  return injector.getInstance(MapName_).then(map => !map ? Promise.resolve(createBoard()) : loadMapImpl(map)(injector).then(m => m));
}

export async function DukeImplementationConstructor(injector: Injector) {
  return injector.getInstance(Board_).then(board => {
    const rorLinks = new RorLinks();
    return Promise.resolve({
      rorLinks: () => rorLinks,
      isMirrorPic(picnum: number) { return picnum == -1 },
    })
  })
}

export function DukeModule(injector: Injector) {
  injector.bindPromise(GRP_, injector.getInstance(FS_).then(fs =>
    fs('DUKE3D.GRP').then(rff => new GrpFile(rff))));
  injector.bindInstance(BoardManipulator_, { cloneBoard });
  injector.bindInstance(Shadowsteps_, 32);
  injector.bind(ArtFiles_, loadArtFiles);
  injector.bind(RAW_PAL_, loadPal);
  injector.bind(RAW_PLUs_, loadRawPlus);
  injector.bindInstance(Palswaps_, 1);
  injector.bind(PAL_, loadPalTexture);
  injector.bind(PLUs_, loadPluTexture);
  injector.bind(Implementation_, DukeImplementationConstructor);
  injector.bind(MapNames_, injector => injector.getInstance(GRP_).then(grp => Object.keys(grp.files).filter(r => r.endsWith('map'))));
  injector.bind(Board_, loadMap);
}