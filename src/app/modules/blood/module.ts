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
import { FS } from '../fs/fs';

export const RFF_ = new Dependency<RffFile>('RFF File');
const RAW_PLUs_ = new Dependency<Uint8Array[]>('Raw PLUs');

function loadRffFile(name: string): (injector: Injector) => Promise<Uint8Array> {
  return (injector: Injector) => new Promise<Uint8Array>(resolve => injector.getInstance(RFF_).then(rff => resolve(rff.get(name))))
}

async function loadArtFiles(injector: Injector): Promise<ArtFiles> {
  const fs = await injector.getInstance(FS);
  const artPromises: Promise<ArtFile>[] = [];
  for (let a = 0; a < 18; a++) artPromises.push(fs('TILES0' + ("00" + a).slice(-2) + '.ART').then(file => new ArtFile(new Stream(file, true))))
  const artFiles = await Promise.all(artPromises);
  return createArts(artFiles);
}

async function loadPLUs(injector: Injector) {
  return (await injector.getInstance(RAW_PLUs_)).length;
}

async function loadPalTexture(injector: Injector) {
  return Promise.all([injector.getInstance(RAW_PAL_), injector.getInstance(GL)]).then(([pal, gl]) => createTexture(256, 1, gl, { filter: gl.NEAREST }, pal, gl.RGB, 3))
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
    const rff = await injector.getInstance(RFF_)
    return loadBloodMap(new Stream(rff.get(name).buffer, true));
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
  const rff = await injector.getInstance(RFF_);
  return rff.fat.filter(r => r.filename.endsWith('.map')).map(r => r.filename);
}

async function loadRff(injector: Injector) {
  const fs = await injector.getInstance(FS);
  const rff = await fs('BLOOD.RFF');
  return new RffFile(rff);
}

export function BloodModule(injector: Injector) {
  injector.bindInstance(ParallaxTextures_, 16);
  injector.bindInstance(BoardManipulator_, { cloneBoard });
  injector.bindInstance(Shadowsteps_, 64);
  injector.bind(RFF_, loadRff);
  injector.bind(ArtFiles_, loadArtFiles);
  injector.bind(RAW_PAL_, loadRffFile('BLOOD.PAL'));
  injector.bind(RAW_PLUs_, loarRawPlus);
  injector.bind(Palswaps_, loadPLUs);
  injector.bind(PAL_, loadPalTexture);
  injector.bind(PLUs_, loadPluTexture);
  injector.bind(Implementation_, BloodImplementationConstructor);
  injector.bind(MapNames_, getMapNames);
  injector.bind(Board_, loadMap);
}