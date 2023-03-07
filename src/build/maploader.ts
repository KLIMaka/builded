import { struct, bits, ushort, int, short, byte, ubyte, uint, Stream, array } from '../utils/stream';
import { SectorStats, Sector, WallStats, Wall, SpriteStats, Sprite, Board, FACE_SPRITE } from './board/structs';
import { ZSCALE } from './utils';

const sectorStats = struct(SectorStats)
  .field('parallaxing', bits(1))
  .field('slopped', bits(1))
  .field('swapXY', bits(1))
  .field('doubleSmooshiness', bits(1))
  .field('xflip', bits(1))
  .field('yflip', bits(1))
  .field('alignToFirstWall', bits(1))
  .field('unk', bits(9));

export const sectorStruct = struct(Sector)
  .field('wallptr', ushort)
  .field('wallnum', ushort)
  .field('ceilingz', int)
  .field('floorz', int)
  .field('ceilingstat', sectorStats)
  .field('floorstat', sectorStats)
  .field('ceilingpicnum', ushort)
  .field('ceilingheinum', short)
  .field('ceilingshade', byte)
  .field('ceilingpal', ubyte)
  .field('ceilingxpanning', ubyte)
  .field('ceilingypanning', ubyte)
  .field('floorpicnum', ushort)
  .field('floorheinum', short)
  .field('floorshade', byte)
  .field('floorpal', ubyte)
  .field('floorxpanning', ubyte)
  .field('floorypanning', ubyte)
  .field('visibility', byte)
  .field('filler', byte)
  .field('lotag', ushort)
  .field('hitag', ushort)
  .field('extra', ushort);

export const wallStats = struct(WallStats)
  .field('blocking', bits(1))
  .field('swapBottoms', bits(1))
  .field('alignBottom', bits(1))
  .field('xflip', bits(1))
  .field('masking', bits(1))
  .field('oneWay', bits(1))
  .field('blocking2', bits(1))
  .field('translucent', bits(1))
  .field('yflip', bits(1))
  .field('translucentReversed', bits(1))
  .field('unk', bits(6));

export const wallStruct = struct(Wall)
  .field('x', int)
  .field('y', int)
  .field('point2', ushort)
  .field('nextwall', short)
  .field('nextsector', short)
  .field('cstat', wallStats)
  .field('picnum', ushort)
  .field('overpicnum', ushort)
  .field('shade', byte)
  .field('pal', ubyte)
  .field('xrepeat', ubyte)
  .field('yrepeat', ubyte)
  .field('xpanning', ubyte)
  .field('ypanning', ubyte)
  .field('lotag', ushort)
  .field('hitag', ushort)
  .field('extra', ushort);

const spriteStats = struct(SpriteStats)
  .field('blocking', bits(1))
  .field('translucent', bits(1))
  .field('xflip', bits(1))
  .field('yflip', bits(1))
  .field('type', bits(2))
  .field('onesided', bits(1))
  .field('realCenter', bits(1))
  .field('blocking2', bits(1))
  .field('tranclucentReversed', bits(1))
  .field('noautoshading', bits(1))
  .field('unk', bits(4))
  .field('invisible', bits(1));

export const spriteStruct = struct(Sprite)
  .field('x', int)
  .field('y', int)
  .field('z', int)
  .field('cstat', spriteStats)
  .field('picnum', ushort)
  .field('shade', byte)
  .field('pal', ubyte)
  .field('clipdist', ubyte)
  .field('filler', ubyte)
  .field('xrepeat', ubyte)
  .field('yrepeat', ubyte)
  .field('xoffset', byte)
  .field('yoffset', byte)
  .field('sectnum', ushort)
  .field('statnum', ushort)
  .field('ang', ushort)
  .field('owner', ushort)
  .field('xvel', short)
  .field('yvel', short)
  .field('zvel', short)
  .field('lotag', ushort)
  .field('hitag', ushort)
  .field('extra', ushort);

export const boardStruct = struct(Board)
  .field('version', uint)
  .field('posx', int)
  .field('posy', int)
  .field('posz', int)
  .field('ang', ushort)
  .field('cursectnum', ushort);

export function loadBuildMap(stream: Stream): Board {
  const brd = boardStruct.read(stream);
  brd.numsectors = ushort.read(stream);
  brd.sectors = array(sectorStruct, brd.numsectors).read(stream);
  brd.numwalls = ushort.read(stream);
  brd.walls = array(wallStruct, brd.numwalls).read(stream);
  brd.numsprites = ushort.read(stream);
  brd.sprites = array(spriteStruct, brd.numsprites).read(stream);
  return brd;
}

export function saveBuildMap(board: Board): ArrayBuffer {
  const size = boardStruct.size
    + 2 + sectorStruct.size * board.numsectors
    + 2 + wallStruct.size * board.numwalls +
    + 2 + spriteStruct.size * board.numsprites;
  const buffer = new ArrayBuffer(size);
  const stream = new Stream(buffer);
  boardStruct.write(stream, board);
  ushort.write(stream, board.numsectors);
  array(sectorStruct, board.numsectors).write(stream, fixSectorSlopes(board.sectors));
  ushort.write(stream, board.numwalls);
  array(wallStruct, board.numwalls).write(stream, board.walls);
  ushort.write(stream, board.numsprites);
  array(spriteStruct, board.numsprites).write(stream, board.sprites);
  return buffer;
}

function fixSectorSlopes(sectors: Sector[]) {
  for (const sec of sectors) {
    sec.ceilingstat.slopped = 1;
    sec.floorstat.slopped = 1;
  }
  return sectors;
}

export function initWallStats(stat: WallStats) {
  stat.alignBottom = 0;
  stat.blocking = 0;
  stat.blocking2 = 0;
  stat.masking = 0;
  stat.oneWay = 0;
  stat.swapBottoms = 0;
  stat.translucent = 0;
  stat.translucentReversed = 0;
  stat.xflip = 0;
  stat.yflip = 0;
  stat.unk = 0;
  return stat;
}

export function initWall(wall: Wall) {
  wall.x = 0;
  wall.y = 0;
  wall.point2 = -1;
  wall.nextwall = -1;
  wall.nextsector = -1;
  wall.cstat = initWallStats(new WallStats());
  wall.picnum = 0;
  wall.overpicnum = 0;
  wall.shade = 0;
  wall.pal = 0;
  wall.xrepeat = 8;
  wall.yrepeat = 8;
  wall.xpanning = 0;
  wall.ypanning = 0;
  wall.lotag = 0;
  wall.hitag = 0
  wall.extra = 65535;
  return wall;
}

export function newWall() {
  return initWall(new Wall())
}

export function initSectorStats(stat: SectorStats) {
  stat.alignToFirstWall = 0;
  stat.doubleSmooshiness = 0;
  stat.parallaxing = 0;
  stat.slopped = 0;
  stat.swapXY = 0;
  stat.xflip = 0;
  stat.yflip = 0;
  stat.unk = 0;
  return stat;
}

export function initSector(sector: Sector) {
  sector.ceilingheinum = 0;
  sector.ceilingpal = 0;
  sector.ceilingpicnum = 0;
  sector.ceilingshade = 0;
  sector.ceilingstat = initSectorStats(new SectorStats());
  sector.ceilingxpanning = 0;
  sector.ceilingypanning = 0;
  sector.ceilingz = 2048 * ZSCALE;
  sector.extra = 65535;
  sector.floorheinum = 0;
  sector.floorpal = 0;
  sector.floorpicnum = 0;
  sector.floorshade = 0;
  sector.floorstat = initSectorStats(new SectorStats())
  sector.floorxpanning = 0;
  sector.floorypanning = 0;
  sector.floorz = 0;
  sector.hitag = 0;
  sector.lotag = 0;
  sector.visibility = 0;
  sector.wallnum = 0;
  sector.wallptr = 0;
  sector.filler = 0;
  return sector;
}

export function newSector() {
  return initSector(new Sector())
}

export function initSpriteStats(stats: SpriteStats) {
  stats.blocking = 0;
  stats.blocking2 = 0;
  stats.invisible = 0;
  stats.noautoshading = 0;
  stats.onesided = 0;
  stats.realCenter = 0;
  stats.tranclucentReversed = 0;
  stats.translucent = 0;
  stats.type = FACE_SPRITE;
  stats.xflip = 0;
  stats.yflip = 0;
  stats.unk = 0;
  return stats;
}

export function initSprite(sprite: Sprite) {
  sprite.ang = 0;
  sprite.clipdist = 0;
  sprite.cstat = initSpriteStats(new SpriteStats());
  sprite.extra = 65535;
  sprite.hitag = 0;
  sprite.lotag = 0;
  sprite.owner = -1;
  sprite.pal = 0;
  sprite.picnum = 1;
  sprite.sectnum = -1;
  sprite.shade = 0;
  sprite.statnum = 0;
  sprite.x = 0;
  sprite.y = 0;
  sprite.z = 0;
  sprite.xoffset = 0;
  sprite.yoffset = 0;
  sprite.xvel = 0;
  sprite.yvel = 0;
  sprite.xrepeat = 64;
  sprite.yrepeat = 64;
  sprite.filler = 0;
  return sprite;
}

export function newSprite() {
  return initSprite(new Sprite())
}

export function newBoard() {
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

export function cloneSector(sector: Sector): Sector {
  const sectorCopy = new Sector();
  Object.assign(sectorCopy, sector);
  sectorCopy.floorstat = Object.assign(new SectorStats(), sector.floorstat);
  sectorCopy.ceilingstat = Object.assign(new SectorStats(), sector.ceilingstat);
  return sectorCopy;
}

export function cloneWall(wall: Wall): Wall {
  const wallCopy = new Wall();
  Object.assign(wallCopy, wall);
  wallCopy.cstat = Object.assign(new WallStats(), wall.cstat);
  return wallCopy;
}

export function cloneSprite(sprite: Sprite): Sprite {
  const spriteCopy = new Sprite();
  Object.assign(spriteCopy, sprite);
  spriteCopy.cstat = Object.assign(new SpriteStats(), sprite.cstat);
  return spriteCopy;
}

export function cloneBoard(board: Board): Board {
  const copy = new Board();
  Object.assign(copy, board);
  copy.sectors = [];
  copy.walls = [];
  copy.sprites = [];
  for (let i = 0; i < board.numsectors; i++)    copy.sectors[i] = cloneSector(board.sectors[i]);
  for (let i = 0; i < board.numwalls; i++)    copy.walls[i] = cloneWall(board.walls[i]);
  for (let i = 0; i < board.numsprites; i++)    copy.sprites[i] = cloneSprite(board.sprites[i]);
  return copy;
}
