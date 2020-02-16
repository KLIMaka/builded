import { array, atomic_array, bits, int, short, Stream, struct, ubyte } from '../../utils/stream';
import { BloodBoard, BloodSector, BloodSprite, BloodWall, SectorExtra, SpriteExtra, WallExtra } from './structs';
import { Header1 } from '../structs';
import { sectorStruct, wallStruct, spriteStruct } from '../maploader';


function decryptBuffer(buffer: Uint8Array, size: number, key: number) {
  for (let i = 0; i < size; i++) buffer[i] = buffer[i] ^ (key + i);
}

function createStream(arr: Uint8Array) {
  return new Stream(arr.buffer, true);
}

let header1Struct = struct(Header1)
  .field('startX', int)
  .field('startY', int)
  .field('startZ', int)
  .field('startAng', short)
  .field('startSec', short)
  .field('unk', short);

let header2Struct = array(ubyte, 9);

class Header3 {
  public mapRevisions: number;
  public numSectors: number;
  public numWalls: number;
  public numSprites: number;
}

let header3Struct = struct(Header3)
  .field('mapRevisions', int)
  .field('numSectors', short)
  .field('numWalls', short)
  .field('numSprites', short);

let sectorExtraStruct = struct(SectorExtra)
  .field('reference', bits(-14))
  .field('state', bits(1))
  .field('busy', bits(17))
  .field('data', bits(16))
  .field('txID', bits(10))
  .field('waveTime1', bits(3))
  .field('waveTime0', bits(3))
  .field('rxID', bits(10))
  .field('command', bits(8))
  .field('triggerOn', bits(1))
  .field('triggerOff', bits(1))
  .field('busyTime1', bits(12))
  .field('waitTime1', bits(12))
  .field('unk1', bits(1))
  .field('interruptable', bits(1))
  .field('amplitude', bits(-8))
  .field('freq', bits(8))
  .field('waitFlag1', bits(1))
  .field('waitFlag0', bits(1))
  .field('phase', bits(8))
  .field('wave', bits(4))
  .field('shadeAlways', bits(1))
  .field('shadeFloor', bits(1))
  .field('shadeCeiling', bits(1))
  .field('shadeWalls', bits(1))
  .field('shade', bits(-8))
  .field('panAlways', bits(1))
  .field('panFloor', bits(1))
  .field('panCeiling', bits(1))
  .field('Drag', bits(1))
  .field('Underwater', bits(1))
  .field('Depth', bits(3))
  .field('panVel', bits(8))
  .field('panAngle', bits(11))
  .field('wind', bits(1))
  .field('decoupled', bits(1))
  .field('triggerOnce', bits(1))
  .field('isTriggered', bits(1))
  .field('Key', bits(3))
  .field('Push', bits(1))
  .field('Vector', bits(1))
  .field('Reserved', bits(1))
  .field('Enter', bits(1))
  .field('Exit', bits(1))
  .field('Wallpush', bits(1))
  .field('color', bits(1))
  .field('unk2', bits(1))
  .field('busyTime0', bits(12))
  .field('waitTime0', bits(12))
  .field('unk3', bits(1))
  .field('unk4', bits(1))
  .field('ceilpal', bits(4))
  .field('offCeilZ', bits(32))
  .field('onCeilZ', bits(32))
  .field('offFloorZ', bits(32))
  .field('onFloorZ', bits(32))
  .field('marker0', bits(16))
  .field('marker1', bits(16))
  .field('Crush', bits(1))
  .field('ceilxpanFrac', bits(8))
  .field('ceilypanFrac', bits(8))
  .field('floorxpanFrac', bits(8))
  .field('damageType', bits(3))
  .field('floorpal', bits(4))
  .field('floorypanFrac', bits(8))
  .field('locked', bits(1))
  .field('windVel', bits(10))
  .field('windAng', bits(11))
  .field('windAlways', bits(1))
  .field('dudelockout', bits(1))
  .field('bobTheta', bits(11))
  .field('bobZRange', bits(5))
  .field('bobSpeed', bits(-12))
  .field('bobAlways', bits(1))
  .field('bobFloor', bits(1))
  .field('bobCeiling', bits(1))
  .field('bobRotate', bits(1));

let wallExtraStruct = struct(WallExtra)
  .field('reference', bits(-14))
  .field('state', bits(1))
  .field('busy', bits(17))
  .field('data', bits(-16))
  .field('txID', bits(10))
  .field('unk1', bits(6))
  .field('rxID', bits(10))
  .field('command', bits(8))
  .field('triggerOn', bits(1))
  .field('triggerOff', bits(1))
  .field('busyTime', bits(12))
  .field('waitTime', bits(12))
  .field('restState', bits(1))
  .field('interruptable', bits(1))
  .field('panAlways', bits(1))
  .field('panX', bits(-8))
  .field('panY', bits(-8))
  .field('decoupled', bits(1))
  .field('triggerOnce', bits(1))
  .field('unk2', bits(1))
  .field('Key', bits(3))
  .field('Push', bits(1))
  .field('Vector', bits(1))
  .field('Reserved', bits(1))
  .field('unk3', bits(2))
  .field('xPanFrac', bits(8))
  .field('yPanFrac', bits(8))
  .field('Locked', bits(1))
  .field('DudeLockout', bits(1))
  .field('unk4', bits(4))
  .field('unk5', bits(32));

let spriteExtraStruct = struct(SpriteExtra)
  .field('reference', bits(-14))
  .field('state', bits(1))
  .field('busy', bits(17))
  .field('txID', bits(10))
  .field('rxID', bits(10))
  .field('command', bits(8))
  .field('triggerOn', bits(1))
  .field('triggerOff', bits(1))
  .field('Wave', bits(2))
  .field('busyTime', bits(12))
  .field('waitTime', bits(12))
  .field('restState', bits(1))
  .field('interruptable', bits(1))
  .field('unk1', bits(2))
  .field('respawnPending', bits(2))
  .field('unk2', bits(1))
  .field('launchTeam', bits(1))
  .field('dropItem', bits(8))
  .field('decoupled', bits(1))
  .field('triggerOnce', bits(1))
  .field('unk3', bits(1))
  .field('Key', bits(3))
  .field('Push', bits(1))
  .field('Vector', bits(1))
  .field('Impact', bits(1))
  .field('Pickup', bits(1))
  .field('Touch', bits(1))
  .field('Sight', bits(1))
  .field('Proximity', bits(1))
  .field('unk4', bits(2))
  .field('launch12345', bits(5))
  .field('single', bits(1))
  .field('bloodbath', bits(1))
  .field('coop', bits(1))
  .field('DudeLockout', bits(1))
  .field('data1', bits(-16))
  .field('data2', bits(-16))
  .field('data3', bits(-16))
  .field('unk5', bits(11))
  .field('Dodge', bits(-2))
  .field('Locked', bits(1))
  .field('unk6', bits(2))
  .field('respawnOption', bits(2))
  .field('data4', bits(16))
  .field('unk7', bits(6))
  .field('LockMsg', bits(8))
  .field('unk8', bits(12))
  .field('dudeDeaf', bits(1))
  .field('dudeAmbush', bits(1))
  .field('dudeGuard', bits(1))
  .field('dfReserved', bits(1))
  .field('target', bits(-16))
  .field('targetX', bits(-32))
  .field('targetY', bits(-32))
  .field('unk9', bits(-32))
  .field('unk10', bits(16))
  .field('unk11', bits(-16))
  .field('unk12', bits(16))
  .field('aiTimer', bits(16))
  .field('ai', bits(32));

const sectorReader = atomic_array(ubyte, sectorStruct.size);
function readSectors(header3: Header3, stream: Stream): BloodSector[] {
  const dec = ((header3.mapRevisions * sectorStruct.size) & 0xFF);
  const sectors = [];
  for (let i = 0; i < header3.numSectors; i++) {
    const buf = sectorReader.read(stream);
    decryptBuffer(buf, sectorStruct.size, dec);
    const sector = <BloodSector>sectorStruct.read(createStream(buf));
    sectors.push(sector);
    if (sector.extra != 0 && sector.extra != 65535)
      sector.extraData = sectorExtraStruct.read(stream);
  }
  return sectors;
}

const wallReader = atomic_array(ubyte, wallStruct.size);
function readWalls(header3: any, stream: Stream): BloodWall[] {
  const dec = (((header3.mapRevisions * sectorStruct.size) | 0x4d) & 0xFF);
  const walls = [];
  for (let i = 0; i < header3.numWalls; i++) {
    const buf = wallReader.read(stream);
    decryptBuffer(buf, wallStruct.size, dec);
    const wall = <BloodWall>wallStruct.read(createStream(buf));
    walls.push(wall);
    if (wall.extra != 0 && wall.extra != 65535)
      wall.extraData = wallExtraStruct.read(stream);
  }
  return walls;
}

const spriteReader = atomic_array(ubyte, spriteStruct.size);
function readSprites(header3: any, stream: Stream): BloodSprite[] {
  const dec = (((header3.mapRevisions * spriteStruct.size) | 0x4d) & 0xFF);
  const sprites = [];
  for (let i = 0; i < header3.numSprites; i++) {
    const buf = spriteReader.read(stream);
    decryptBuffer(buf, spriteStruct.size, dec);
    const sprite = <BloodSprite>spriteStruct.read(createStream(buf));
    sprites.push(sprite);
    if (sprite.extra != 0 && sprite.extra != 65535)
      sprite.extraData = spriteExtraStruct.read(stream);
  }
  return sprites;
}

function createBoard(version: number, header1: any, header3: any, sectors: BloodSector[], walls: BloodWall[], sprites: BloodSprite[]): BloodBoard {
  const brd = new BloodBoard();
  brd.version = version;
  brd.posx = header1.startX;
  brd.posy = header1.startY;
  brd.posz = header1.startZ;
  brd.ang = header1.startAng;
  brd.cursectnum = header1.startSec;
  brd.numsectors = header3.numSectors;
  brd.numwalls = header3.numWalls;
  brd.numsprites = header3.numSprites;
  brd.sectors = sectors;
  brd.walls = walls;
  brd.sprites = sprites;
  return brd;
}

export function loadBloodMap(stream: Stream): BloodBoard {
  const header = int.read(stream);
  const version = short.read(stream);
  let buf = atomic_array(ubyte, header1Struct.size).read(stream);
  decryptBuffer(buf, header1Struct.size, 0x4d);
  const header1 = header1Struct.read(createStream(buf));
  stream.skip(header2Struct.size);
  buf = atomic_array(ubyte, header3Struct.size).read(stream);
  decryptBuffer(buf, header3Struct.size, 0x68);
  const header3 = header3Struct.read(createStream(buf));
  stream.skip(128 + (1 << header1.unk) * 2);

  const sectors = readSectors(header3, stream);
  const walls = readWalls(header3, stream);
  const sprites = readSprites(header3, stream);

  return createBoard(version, header1, header3, sectors, walls, sprites);
}

export function cloneSector(sector: BloodSector): BloodSector {
  const sectorCopy = new BloodSector();
  Object.assign(sectorCopy, sector);
  Object.assign(sectorCopy.floorstat, sector.floorstat);
  Object.assign(sectorCopy.ceilingstat, sector.ceilingstat);
  if (sector.extraData) Object.assign(sectorCopy.extraData, sector.extraData);
  return sectorCopy;
}

export function cloneWall(wall: BloodWall): BloodWall {
  const wallCopy = new BloodWall();
  Object.assign(wallCopy, wall);
  Object.assign(wallCopy.cstat, wall.cstat);
  if (wall.extraData) Object.assign(wallCopy.extraData, wall.extraData);
  return wallCopy;
}

export function cloneSprite(sprite: BloodSprite): BloodSprite {
  const spriteCopy = new BloodSprite();
  Object.assign(spriteCopy, sprite);
  Object.assign(spriteCopy.cstat, sprite.cstat);
  if (sprite.extraData) Object.assign(spriteCopy.extraData, sprite.extraData);
  return spriteCopy;
}

export function cloneBoard(board: BloodBoard): BloodBoard {
  const copy = new BloodBoard();
  Object.assign(copy, board);
  copy.sectors = [];
  copy.walls = [];
  copy.sprites = [];
  for (let i = 0; i < board.numsectors; i++)  copy.sectors[i] = cloneSector(board.sectors[i]);
  for (let i = 0; i < board.numwalls; i++)  copy.walls[i] = cloneWall(board.walls[i]);
  for (let i = 0; i < board.numsprites; i++)  copy.sprites[i] = cloneSprite(board.sprites[i]);
  return copy;
}