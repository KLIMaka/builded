import { Injector, Dependency } from '../../../utils/injector'
import { RffFile } from '../../../build/rff'
import { loadBin } from '../../../utils/getter'
import { ArtFiles, createArts, ArtFile } from '../../../build/art';
import { Stream } from '../../../utils/stream';
import { ArtFiles_, GL_, BuildArtProviderConstructor } from '../buildartprovider';
import { RAW_PAL_ } from '../artselector';
import { BoardManipulator_, Board_, BuildReferenceTracker, ArtProvider_ } from '../../apis/app';
import { Shadowsteps_, Palswaps_, PAL_, PLUs_ } from '../buildgl';
import { cloneBoard, loadBloodMap } from '../../../build/blood/maploader'
import { createTexture } from '../../../utils/gl/textures';
import { BloodBoard, BloodSprite } from '../../../build/blood/structs';
import { Deck } from '../../../utils/collections';
import { ReferenceTrackerImpl } from '../../apis/referencetracker';
import { createNewSector } from '../../../build/boardutils';
import { SpriteStats } from '../../../build/structs';
import { Implementation_ } from '../view/boardrenderer3d';
import { BloodImplementationConstructor } from '../../../build/blood/utils';

const RFF_ = new Dependency<RffFile>('RFF File');
const RAW_PLUs_ = new Dependency<Uint8Array[]>('Raw PLUs');

function loadRffFile(name: string): (injector: Injector) => Promise<Uint8Array> {
  return (injector: Injector) => new Promise<Uint8Array>(resolve => injector.getInstance(RFF_).then(rff => resolve(rff.get(name))))
}

async function loadArtFiles(root: string): Promise<ArtFiles> {
  const artPromises: Promise<ArtFile>[] = [];
  for (let a = 0; a < 18; a++)     artPromises.push(loadBin(root + 'TILES0' + ("00" + a).slice(-2) + '.ART').then(file => new ArtFile(new Stream(file, true))))
  return Promise.all(artPromises).then(artFiles => createArts(artFiles))
}

async function loadPLUs(injector: Injector) {
  return injector.getInstance(RAW_PLUs_).then(plus => plus.length)
}

async function loadPalTexture(injector: Injector) {
  return Promise.all([injector.getInstance(RAW_PAL_), injector.getInstance(GL_)]).then(([pal, gl]) => createTexture(256, 1, gl, { filter: gl.NEAREST }, pal, gl.RGB, 3))
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
    injector.getInstance(GL_),
    injector.getInstance(Shadowsteps_)])
    .then(([plus, gl, shadowsteps]) => {
      const tex = new Uint8Array(256 * shadowsteps * plus.length);
      let i = 0;
      for (const plu of plus) tex.set(plu, 256 * shadowsteps * i++);
      return createTexture(256, shadowsteps * plus.length, gl, { filter: gl.NEAREST }, tex, gl.LUMINANCE)
    })
}

function loadMap(name: string) { return async (injector: Injector) => injector.getInstance(RFF_).then(rff => loadBloodMap(new Stream(rff.get(name).buffer, true))) }



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

export function BloodModule(root: string, map: string) {
  return (injector: Injector) => {
    injector.bindPromise(RFF_, loadBin(root + 'BLOOD.RFF').then(rff => new RffFile(rff)));
    injector.bindPromise(ArtFiles_, loadArtFiles(root));
    injector.bindInstance(BoardManipulator_, { cloneBoard });
    injector.bindInstance(Shadowsteps_, 64);
    injector.bind(RAW_PAL_, loadRffFile('BLOOD.PAL'));
    injector.bind(RAW_PLUs_, loarRawPlus);
    injector.bind(Palswaps_, loadPLUs);
    injector.bind(PAL_, loadPalTexture);
    injector.bind(PLUs_, loadPluTexture);
    injector.bind(Implementation_, BloodImplementationConstructor);

    if (!map) injector.bindInstance(Board_, createBoard())
    else injector.bind(Board_, loadMap(map));
  }
}