import { BuildReferenceTracker, GridController } from '../app/apis/app';
import { track } from '../app/apis/referencetracker';
import { vec3 } from '../libs_js/glmatrix';
import { all, Collection, cyclicPairs, cyclicRange, Deck, enumerate, IndexedDeck, interpolate, intersect, loopPairs, map, reverse, wrap } from '../utils/collections';
import { NumberInterpolator } from '../utils/interpolator';
import { iter } from '../utils/iter';
import { cross2d, cyclic, int, len2d, lenPointToLine, tuple2, tuple4 } from '../utils/mathutils';
import { copySector, copySprite, copyWall, loopPoints, loopWalls, moveWalls, newSector, newSprite, newWall, resizeWalls, SectorBuilder } from './board/internal';
import { Board, Sector, Sprite, Wall } from './board/structs';
import { ArtInfoProvider } from './formats/art';
import { Hitscan, hitscan } from './hitscan';
import { findSector, sectorOfWall, sectorWalls, wallNormal, slope } from './utils';

export const DEFAULT_REPEAT_RATE = 128;

export function loopWallsFull(board: Board, wallId: number): Collection<number> {
  const loop = new IndexedDeck<number>();
  const cwalls = new Deck<number>();
  const unconnected = new Deck<number>();
  loop.pushAll(loopWalls(board, wallId));
  for (const isec of loopInnerSectors(board, wallId)) {
    for (const lpoint of loopPoints(board, isec)) {
      const lwalls = loopWalls(board, lpoint);
      unconnected.clear();
      for (const w of lwalls) {
        connectedWalls(board, w, cwalls.clear());
        if (!loop.hasAny(cwalls)) unconnected.push(w);
      }
      loop.pushAll(unconnected);
    }
  }
  return loop;
}

function distanceToWallSegment(board: Board, wallId: number, x: number, y: number): number {
  let wall = board.walls[wallId];
  let wall2 = board.walls[wall.point2];
  return lenPointToLine(x, y, wall.x, wall.y, wall2.x, wall2.y);
}

function distanceToWallPoint(board: Board, wallId: number, x: number, y: number): number {
  let wall = board.walls[wallId];
  return len2d(x - wall.x, y - wall.y);
}

let closestWallPoint_: [number, number] = [0, 0];
export function closestWallPointDist(board: Board, x: number, y: number): [number, number] {
  let closestWall = -1;
  let mindist = Number.MAX_VALUE;
  for (let w = 0; w < board.numwalls; w++) {
    let dist = distanceToWallPoint(board, w, x, y);
    if (dist < mindist) {
      closestWall = w;
      mindist = dist;
    }
  }
  return tuple2(closestWallPoint_, closestWall, mindist);
}

export function closestWallPoint(board: Board, x: number, y: number, d: number): number {
  const [w, dist] = closestWallPointDist(board, x, y);
  return dist <= d ? w : -1;
}

let closestWallInSectorDist_: [number, number] = [0, 0];
export function closestWallInSectorDist(board: Board, secId: number, x: number, y: number): [number, number] {
  let sec = board.sectors[secId];
  let end = sec.wallptr + sec.wallnum;
  let mindist = Number.MAX_VALUE;
  let wallId = -1;
  for (let w = sec.wallptr; w < end; w++) {
    let wall = board.walls[w];
    let dist = len2d(wall.x - x, wall.y - y);
    if (dist < mindist) {
      mindist = dist;
      wallId = w;
    }
  }
  return tuple2(closestWallInSectorDist_, wallId, mindist);
}

export function closestWallInSector(board: Board, secId: number, x: number, y: number, d: number): number {
  const [w, dist] = closestWallInSectorDist(board, secId, x, y);
  return dist <= d ? w : -1;
}

let closestWallSegmentInSectorDist_: [number, number] = [0, 0];
export function closestWallSegmentInSectorDist(board: Board, secId: number, x: number, y: number): [number, number] {
  let sec = board.sectors[secId];
  let end = sec.wallptr + sec.wallnum;
  let mindist = Number.MAX_VALUE;
  let wallId = -1;
  for (let w = sec.wallptr; w < end; w++) {
    let dist = distanceToWallSegment(board, w, x, y);
    if (dist < mindist) {
      mindist = dist;
      wallId = w;
    }
  }
  return tuple2(closestWallSegmentInSectorDist_, wallId, mindist);
}

export function closestWallSegmentInSector(board: Board, secId: number, x: number, y: number, d: number): number {
  const [w, dist] = closestWallSegmentInSectorDist(board, secId, x, y);
  return dist <= d ? w : -1;
}

const closestSpriteInSectorDist_: [number, number] = [0, 0];
export function closestSpriteInSectorDist(board: Board, secId: number, x: number, y: number): [number, number] {
  let spriteId = -1;
  let mindist = Number.MAX_VALUE;
  for (let s = 0; s < board.numsprites; s++) {
    const sprite = board.sprites[s];
    if (sprite.sectnum != secId) continue;
    const dist = len2d(sprite.x - x, sprite.y - y);
    if (dist < mindist) {
      mindist = dist;
      spriteId = s;
    }
  }
  return tuple2(closestSpriteInSectorDist_, spriteId, mindist);
}

export function closestSpriteInSector(board: Board, secId: number, x: number, y: number, d: number): number {
  const [s, dist] = closestSpriteInSectorDist(board, secId, x, y);
  return dist <= d ? s : -1;
}

export function wallInSector(board: Board, secId: number, x: number, y: number) {
  let sec = board.sectors[secId];
  let end = sec.wallptr + sec.wallnum;
  for (let w = sec.wallptr; w < end; w++) {
    let wall = board.walls[w];
    if (wall.x == x && wall.y == y) return w;
  }
  return -1;
}

let closestWallSegmentDist_: [number, number] = [0, 0];
export function closestWallSegmentDist(board: Board, x: number, y: number): [number, number] {
  const sectorId = findSector(board, x, y);
  let wallId = -1;
  let mindist = Number.MAX_VALUE;
  for (let w = 0; w < board.numwalls; w++) {
    let dist = distanceToWallSegment(board, w, x, y);
    if (Math.abs(dist - mindist) < 0.0001) {
      const wall = board.walls[wallId];
      wallId = wall.nextsector == sectorId ? w : wallId;
    } else if (dist < mindist) {
      mindist = dist;
      wallId = w;
    }
  }
  return tuple2(closestWallSegmentDist_, wallId, mindist);
}

export function closestWallSegment(board: Board, x: number, y: number, d: number): number {
  const [w, dist] = closestWallSegmentDist(board, x, y);
  return dist <= d ? w : -1;
}

function deleteSectorImpl(board: Board, sectorId: number, refs: BuildReferenceTracker) {
  if (board.sectors[sectorId].wallnum != 0)
    throw new Error(`Error while deleting sector #${sectorId}. wallnum != 0`);

  for (let w = 0; w < board.numwalls; w++) {
    let wall = board.walls[w];
    if (wall.nextsector == sectorId)
      throw new Error(`Error while deleting sector #${sectorId}. Wall #${w} referensing sector`);
    if (wall.nextsector > sectorId)
      wall.nextsector--;
  }
  for (let s = 0; s < board.numsprites; s++) {
    let spr = board.sprites[s];
    if (spr.sectnum == sectorId)
      throw new Error(`Error while deleting sector #${sectorId}. Sprite #${s} referensing sector`);
    if (spr.sectnum > sectorId)
      spr.sectnum--;
  }
  for (let s = sectorId; s < board.numsectors - 1; s++) {
    board.sectors[s] = board.sectors[s + 1];
  }
  refs.sectors.update((s) => s == sectorId ? -1 : s > sectorId ? s - 1 : s);
  board.sectors[board.numsectors - 1] = null;
  board.numsectors--;
}

function addSector(board: Board, sector: Sector) {
  let idx = board.numsectors;
  board.sectors[idx] = sector;
  sector.wallptr = board.numwalls;
  board.numsectors++;
  return idx;
}

export function walllen(board: Board, wallId: number) {
  let wall = board.walls[wallId];
  let wall2 = board.walls[wall.point2];
  let dx = wall2.x - wall.x;
  let dy = wall2.y - wall.y;
  return len2d(dx, dy);
}

export function fixxrepeat(board: Board, wallId: number, reprate: number = DEFAULT_REPEAT_RATE) {
  let wall = board.walls[wallId];
  wall.xrepeat = Math.min(255, Math.max(1, Math.round((walllen(board, wallId) + 0.5) / reprate)))
}

function fixpoint2xpan(board: Board, wallId: number, art: ArtInfoProvider) {
  let wall = board.walls[wallId];
  let wall2 = board.walls[wall.point2];
  wall2.xpanning = ((wall.xpanning + (wall.xrepeat << 3)) % art.getInfo(wall.picnum).w) & 0xff;
}

export function insertWall(board: Board, wallId: number, x: number, y: number, art: ArtInfoProvider, refs: BuildReferenceTracker): number {
  let secId = sectorOfWall(board, wallId);
  let wall = board.walls[wallId];
  let lenperrep = walllen(board, wallId) / Math.max(wall.xrepeat, 1);
  moveWalls(board, secId, wallId, 1, refs);
  let nwall = copyWall(wall, x, y);
  board.walls[wallId + 1] = nwall;
  wall.point2 = wallId + 1;
  fixxrepeat(board, wallId, lenperrep);
  fixpoint2xpan(board, wallId, art);
  fixxrepeat(board, wallId + 1, lenperrep);
  return wallId + 1;
}

export function splitWall(board: Board, wallId: number, x: number, y: number, art: ArtInfoProvider, refs: BuildReferenceTracker): number {
  if (wallId < 0 || wallId >= board.numwalls) throw new Error('Invalid wall: ' + wallId);
  let wall = board.walls[wallId];
  insertWall(board, wallId, x, y, art, refs);
  if (wall.nextwall != -1) {
    let nextwallId = wall.nextwall;
    insertWall(board, nextwallId, x, y, art, refs);
    let wallId = board.walls[nextwallId].nextwall;
    board.walls[wallId].nextwall = nextwallId + 1;
    board.walls[wallId + 1].nextwall = nextwallId;
    board.walls[nextwallId].nextwall = wallId + 1;
    board.walls[nextwallId + 1].nextwall = wallId;
    return wallId;
  }
  return wallId;
}

export function lastwall(board: Board, wallId: number): number {
  if (wallId > 0 && board.walls[wallId - 1].point2 == wallId)
    return wallId - 1;
  for (let w = wallId; ; w = board.walls[w].point2) {
    if (board.walls[w].point2 == wallId)
      return w;
  }
}

export function nextwall(board: Board, wallId: number): number {
  return board.walls[wallId].point2;
}

function doMoveWall(board: Board, w: number, x: number, y: number) {
  board.walls[w].x = x;
  board.walls[w].y = y;
  fixxrepeat(board, w);
  fixxrepeat(board, lastwall(board, w));
}

let connectedSet = new Set<number>();
export function connectedWalls(board: Board, wallId: number, result: Deck<number>): Deck<number> {
  connectedSet.clear();
  const walls = board.walls;
  let counter = 0;
  let w = wallId;
  connectedSet.add(w);
  do {
    const wall = walls[w];
    if (wall.nextwall != -1) {
      w = nextwall(board, wall.nextwall);
      connectedSet.add(w);
    } else {
      w = wallId;
      do {
        const last = lastwall(board, w);
        const wall = walls[last];
        if (wall.nextwall != -1) {
          w = wall.nextwall;
          connectedSet.add(w);
        } else break;
      } while (w != wallId)
    }
    counter++;
    if (counter > board.numwalls) throw new Error('Cycled connected walls');
  } while (w != wallId)
  return result.pushAll(connectedSet);
}

let wallsToMove = new Deck<number>();
export function moveWall(board: Board, wallId: number, x: number, y: number): boolean {
  let walls = board.walls;
  let wall = walls[wallId];
  if (wall.x == x && wall.y == y) return false;
  connectedWalls(board, wallId, wallsToMove.clear());
  for (let w of wallsToMove) doMoveWall(board, w, x, y);
  return true;
}

export function moveSprite(board: Board, sprId: number, x: number, y: number, z: number): boolean {
  var spr = board.sprites[sprId];
  if (spr.x == x && spr.y == y && spr.z == z) return false;
  spr.x = x; spr.y = y; spr.z = z;
  spr.sectnum = findSector(board, x, y, spr.sectnum);
  return true;
}

const snapResult: [number, number] = [0, 0];
export function snapWall(board: Board, w: number, x: number, y: number, grid: GridController) {
  const wall = board.walls[w];
  const w1 = nextwall(board, w);
  const wall1 = board.walls[w1];
  const dx = wall1.x - wall.x;
  const dy = wall1.y - wall.y;
  const repeat = DEFAULT_REPEAT_RATE * wall.xrepeat;
  const dxt = x - wall.x;
  const dyt = y - wall.y;
  const dt = len2d(dxt, dyt) / len2d(dx, dy);
  const t = grid.snap(dt * repeat) / repeat;
  const xs = int(wall.x + (t * dx));
  const ys = int(wall.y + (t * dy));
  return tuple2(snapResult, xs, ys);
}

const hit = new Hitscan();
export function moveSpriteHitscan(board: Board, sprId: number, x: number, y: number, z: number, grid: GridController): boolean {
  const spr = board.sprites[sprId];
  if (spr.x == x && spr.y == y && spr.z == z) return false;
  const vx = x - spr.x;
  const vy = y - spr.y;
  const vz = z - spr.z;
  hitscan(board, null, spr.x, spr.y, spr.z, spr.sectnum, vx, vy, vz, hit, 1);
  const ent = hit.ent;
  if (hit.t != -1 && hit.t <= 1 && ent.isWall()) {
    const normal = wallNormal(vec3.create(), board, ent.id);
    const offx = normal[0] * 4;
    const offy = normal[2] * 4;
    [x, y] = snapWall(board, ent.id, hit.coords[0], hit.coords[1], grid);
    x = int(x + offx);
    y = int(y + offy);
  }
  spr.x = x; spr.y = y; spr.z = z;
  spr.sectnum = findSector(board, x, y, spr.sectnum);
  return true;
}

function ornamentWall(board: Board, wallId: number, x: number, y: number, grid: GridController): [number, number] {
  const n = wallNormal(vec3.create(), board, wallId);
  const [nx, ny] = snapWall(board, wallId, x, y, grid)
  return [int(nx + n[0] * 4), int(ny + n[2] * 4)];
}

function selectOrnamentWall(board: Board, sectorId: number, wallId: number, x: number, y: number, z: number): [number, number] {
  const sector = board.sectors[sectorId];
  const wall = board.walls[wallId];
  if (wall.nextwall != -1) {
    const nextSectorId = wall.nextsector;
    const nextSector = board.sectors[nextSectorId];
    const f1z = slope(board, sectorId, x, y, sector.floorheinum) + sector.floorz;
    const c1z = slope(board, sectorId, x, y, sector.ceilingheinum) + sector.ceilingz;
    const f2z = slope(board, nextSectorId, x, y, nextSector.floorheinum) + nextSector.floorz;
    const c2z = slope(board, nextSectorId, x, y, nextSector.ceilingheinum) + nextSector.ceilingz;
    if ((z > f1z || z < c1z) && z <= f2z && z >= c2z) return [wall.nextwall, wall.nextsector];
    if ((z > f2z || z < c2z) && z <= f1z && z >= c1z) return [wallId, sectorId];
    return [-1, -1];
  }
  return [wallId, sectorId];
}

function tryMoveSprite(sprite: Sprite, x: number, y: number, z: number, sectorId: number): boolean {
  if (sprite.x == x && sprite.y == y && sprite.z == z && sprite.sectnum == sectorId) return false;
  sprite.x = x;
  sprite.y = y;
  sprite.z = z;
  sprite.sectnum = sectorId;
  return true;
}

export function moveSpriteX(board: Board, spriteId: number, x: number, y: number, z: number, grid: GridController): boolean {
  const sprite = board.sprites[spriteId];
  if (sprite.x == x && sprite.y == y && sprite.z == z) return false;
  const tsectorId = findSector(board, x, y, sprite.sectnum);
  const newSectorId = tsectorId == -1 ? sprite.sectnum : tsectorId;
  const newSector = board.sectors[newSectorId];
  const d = grid.getGridSize();
  const w = iter(sectorWalls(newSector)).first(w => distanceToWallSegment(board, w, x, y) <= d, -1);
  if (w != -1) {
    const ow = selectOrnamentWall(board, newSectorId, w, x, y, sprite.z);
    if (ow[0] == -1) {
      return tryMoveSprite(sprite, x, y, z, newSectorId);
    } else {
      const [nx, ny] = ornamentWall(board, ow[0], x, y, grid);
      return tryMoveSprite(sprite, nx, ny, z, ow[1]);
    }
  } else {
    if (tsectorId == -1) return false;
    return tryMoveSprite(sprite, x, y, z, newSectorId);
  }
}

let wallNormal_ = vec3.create();
export function pushWall(board: Board, wallId: number, len: number, art: ArtInfoProvider, alwaysNewPoints = false, refs: BuildReferenceTracker): number {
  if (len == 0) return wallId;
  let w1 = wallId; let wall1 = board.walls[w1];
  let w2 = wall1.point2; let wall2 = board.walls[w2];
  let p1 = lastwall(board, w1); let prev1 = board.walls[p1];
  let n2 = wall2.point2; let next2 = board.walls[n2];
  let normal = wallNormal(wallNormal_, board, wallId);
  vec3.scale(normal, normal, len);
  let [nx, _, ny] = normal;
  let x1 = int(wall1.x + nx); let y1 = int(wall1.y + ny);
  let x2 = int(wall2.x + nx); let y2 = int(wall2.y + ny);

  if (alwaysNewPoints) {
    w1 = splitWall(board, w1, x1, y1, art, refs);
    w2 = nextwall(board, w1);
    return splitWall(board, w2, x2, y2, art, refs);
  }

  let extent1 = cross2d(x1 - prev1.x, y1 - prev1.y, wall1.x - prev1.x, wall1.y - prev1.y) == 0;
  let extent2 = cross2d(x2 - next2.x, y2 - next2.y, wall2.x - next2.x, wall2.y - next2.y) == 0;

  if (extent1 && extent2) {
    moveWall(board, w1, x1, y1);
    moveWall(board, w2, x2, y2);
    return w1;
  } else if (extent1 && !extent2) {
    moveWall(board, w1, x1, y1);
    return splitWall(board, w1, x2, y2, art, refs);
  } else if (!extent1 && extent2) {
    w1 = splitWall(board, w1, x1, y1, art, refs);
    w2 = nextwall(board, nextwall(board, w1));
    moveWall(board, w2, x2, y2);
    return nextwall(board, w1);
  } else if (!extent1 && !extent2) {
    w1 = splitWall(board, w1, x1, y1, art, refs);
    w2 = nextwall(board, w1);
    return splitWall(board, w2, x2, y2, art, refs);
  }
}

export function packWallSectorId(wallId: number, sectorId: number) {
  return wallId | (sectorId << 16)
}

export function unpackWallId(wallSectorId: number) {
  return wallSectorId & 0xffff;
}

export function unpackSectorId(wallSectorId: number) {
  return (wallSectorId >> 16) & 0xffff;
}

export function isJoinedSectors(board: Board, s1: number, s2: number) {
  let sec1 = board.sectors[s1];
  let end = sec1.wallptr + sec1.wallnum;
  for (let w = sec1.wallptr; w < end; w++) {
    let wall = board.walls[w];
    if (wall.nextsector == s2)
      return w;
  }
  return -1;
}

function fillSectorWalls(board: Board, s: number, set: Set<number>) {
  let sec = board.sectors[s];
  for (const w of sectorWalls(sec)) set.add(w);
}

let wallset = new Set<number>();
function fillWallSet(board: Board, s1: number, s2: number) {
  wallset.clear();
  fillSectorWalls(board, s1, wallset);
  fillSectorWalls(board, s2, wallset);
  return wallset;
}

function updateSpriteSector(board: Board, fromSector: number) {
  for (let s = 0; s < board.numsprites; s++) {
    let spr = board.sprites[s];
    if (spr.sectnum == fromSector)
      spr.sectnum = findSector(board, spr.x, spr.y, spr.sectnum);
  }
}

function getJoinedWallsLoops(board: Board, s1: number, s2: number): SectorBuilder {
  const builder = new SectorBuilder();
  const wallset = fillWallSet(board, s1, s2);
  const values = wallset.values();
  for (let it = values.next(); !it.done; it = values.next()) {
    let w = it.value;
    const loopstart = w;
    for (; ;) {
      const wall = board.walls[w];
      wallset.delete(w);
      if (wall.nextsector == s1 || wall.nextsector == s2) {
        wallset.delete(wall.nextwall);
        w = board.walls[wall.nextwall].point2;
      } else {
        builder.addWall(wall);
        w = wall.point2;
      }
      if (w == loopstart) {
        builder.loop();
        break;
      }
    }
  }
  return builder;
}

export function joinSectors(board: Board, s1: number, s2: number, refs: BuildReferenceTracker) {
  if (isJoinedSectors(board, s1, s2) == -1) return -1;
  getJoinedWallsLoops(board, s1, s2).build(board, s1, refs);
  updateSpriteSector(board, s2);
  resizeWalls(board, s2, 0, refs);
  deleteSectorImpl(board, s2, refs);
  return 0;
}

export function deleteSector(board: Board, sectorId: number, refs: BuildReferenceTracker) {
  const sector = board.sectors[sectorId];
  const wallsend = sector.wallptr + sector.wallnum;
  for (let w = sector.wallptr; w < wallsend; w++) {
    const wall = board.walls[w];
    if (wall.nextwall != -1) {
      const nextwall = board.walls[wall.nextwall];
      nextwall.nextsector = -1;
      nextwall.nextwall = -1;
    }
  }
  resizeWalls(board, sectorId, 0, refs);
  deleteSectorImpl(board, sectorId, refs);
}

export function setFirstWall(board: Board, sectorId: number, newFirstWall: number, refs: BuildReferenceTracker) {
  const sector = board.sectors[sectorId];
  if (sector.wallptr == newFirstWall) return;
  const end = sector.wallptr + sector.wallnum;
  if (newFirstWall < sector.wallptr || newFirstWall >= end) return;
  const loops = new Deck<Deck<Wall>>();
  const newFirstWallLoop = new Deck<Wall>();
  let currentLoop = new Deck<Wall>();
  let firstWallLoopPos = -1;
  for (let w = sector.wallptr; w < end; w++) {
    if (w == newFirstWall) firstWallLoopPos = currentLoop.length();
    const wall = board.walls[w];
    currentLoop.push(wall);
    if (wall.point2 < w) {
      if (firstWallLoopPos != -1) {
        for (let i of cyclicRange(firstWallLoopPos, currentLoop.length()))
          newFirstWallLoop.push(currentLoop.get(i));
        firstWallLoopPos = -1;
      } else {
        loops.push(currentLoop);
      }
      currentLoop = new Deck<Wall>();
    }
  }

  const builder = new SectorBuilder().addLoop(newFirstWallLoop);
  for (let loop of loops) builder.addLoop(loop);
  builder.build(board, sectorId, refs);
}

export function clockwise(walls: Collection<[number, number]>): boolean {
  let minx = Number.MAX_VALUE;
  let minwall = -1;
  for (const [w1, w2] of cyclicPairs(walls.length())) {
    let wall2 = walls.get(w2);
    if (wall2[0] < minx) {
      minx = wall2[0];
      minwall = w1;
    }
  }
  let wall0 = walls.get(minwall);
  let wall1 = walls.get(cyclic(minwall + 1, walls.length()));
  let wall2 = walls.get(cyclic(minwall + 2, walls.length()));

  if (wall2[1] <= wall1[1] && wall1[1] <= wall0[1]) return true;
  if (wall0[1] <= wall1[1] && wall1[1] <= wall2[1]) return false;

  return cross2d(wall0[0] - wall1[0], wall0[1] - wall1[1], wall2[0] - wall1[0], wall2[1] - wall1[1]) < 0;
}

function order(points: Collection<[number, number]>, cw = true): Collection<[number, number]> {
  let actual = clockwise(points);
  return actual == cw ? points : reverse(points);
}

function searchMatchWall(board: Board, p1: [number, number], p2: [number, number]): [number, number] {
  for (let s = 0; s < board.numsectors; s++) {
    const sec = board.sectors[s];
    const end = sec.wallptr + sec.wallnum;
    for (let w = sec.wallptr; w < end; w++) {
      const wall1 = board.walls[w];
      if (wall1 == null || wall1.nextwall != -1) continue;
      const wall2 = board.walls[wall1.point2];
      if (wall1.x == p2[0] && wall1.y == p2[1] && wall2.x == p1[0] && wall2.y == p1[1]) {
        return [s, w];
      }
    }
  }
  return null;
}

function matchWalls(board: Board, points: Collection<[number, number]>): [number, number][] {
  return iter(loopPairs(points)).map(([p1, p2]) => searchMatchWall(board, p1, p2)).collect();
}

function commonSectorWall(board: Board, matched: [number, number][]): [Sector, Wall] {
  for (let m of matched) if (m != null) return [board.sectors[m[0]], board.walls[m[1]]];
  return [newSector(), newWall(0, 0)];
}

function* createNewWalls(points: Iterable<[number, number]>, mwalls: [number, number][], commonWall: Wall, board: Board): Generator<Wall> {
  for (const [p, i] of enumerate(points)) {
    const m = mwalls[i];
    const baseWall = m == null ? commonWall : board.walls[m[1]];
    const wall = copyWall(baseWall, p[0], p[1]);
    if (m != null) {
      wall.nextwall = m[1];
      wall.nextsector = m[0];
    } else {
      wall.nextwall = -1;
      wall.nextsector = -1;
    }
    yield wall;
  }
}

export function createNewSector(board: Board, points: Collection<[number, number]>, refs: BuildReferenceTracker) {
  points = order(points);
  let mwalls = matchWalls(board, points);
  let [commonSector, commonWall] = commonSectorWall(board, mwalls);
  let sector = copySector(commonSector);
  let sectorId = addSector(board, sector);
  let walls = createNewWalls(points, mwalls, commonWall, board);
  new SectorBuilder().addLoop(walls).build(board, sectorId, refs);
  for (let w = sector.wallptr; w < sector.wallptr + sector.wallnum; w++) fixxrepeat(board, w);
}

export function createInnerLoop(board: Board, sectorId: number, points: Collection<[number, number]>, refs: BuildReferenceTracker) {
  let sector = board.sectors[sectorId];
  resizeWalls(board, sectorId, sector.wallnum + points.length(), refs);
  let wallPtr = sector.wallptr + sector.wallnum - points.length();
  let firstWall = board.walls[sector.wallptr];
  points = order(points, false);
  for (let [p, i] of enumerate(points)) {
    let wall = copyWall(firstWall, p[0], p[1]);
    wall.point2 = i == points.length() - 1 ? wallPtr : wallPtr + i + 1;
    wall.nextsector = wall.nextwall = -1;
    board.walls[wallPtr + i] = wall;
  }
  for (let w = wallPtr; w < sector.wallptr + sector.wallnum; w++) {
    fixxrepeat(board, w);
  }
}

export function isOuterLoop(board: Board, wallId: number) {
  const points = new Deck<[number, number]>();
  const loop = loopWalls(board, wallId);
  for (let w of loop) points.push([board.walls[w].x, board.walls[w].y]);
  return clockwise(points);
}

export function fillInnerLoop(board: Board, wallId: number, refs: BuildReferenceTracker) {
  const wall = board.walls[wallId];
  const WALL_MAPPER = (w: number) => <[number, number]>[board.walls[w].x, board.walls[w].y];
  if (wall.nextsector != -1) throw new Error(`Already filled`);
  const loop = [...loopWalls(board, wallId)];
  if (!all(loop, w => board.walls[w].nextsector == -1)) throw new Error(`Already filled`);
  const points = wrap([...map(loop, WALL_MAPPER)]);
  if (clockwise(points)) throw new Error('Only inner loops can be filled');
  createNewSector(board, points, refs);
}

export function deleteLoop(board: Board, wallId: number, refs: BuildReferenceTracker) {
  const loop = [...loopWalls(board, wallId)];
  for (let w of loop) if (board.walls[w].nextsector != -1) throw new Error('Cannot delete filled loop');
  if (isOuterLoop(board, wallId)) throw new Error('Cannot delete outer loops');
  const sectorId = sectorOfWall(board, wallId);
  moveWalls(board, sectorId, loop[0], -loop.length, refs);
}

export function loopInnerSectors(board: Board, wallId: number, sectors: Set<number> = new Set<number>()): Set<number> {
  if (isOuterLoop(board, wallId)) return sectors;
  const loop = loopWalls(board, wallId);
  for (let w of loop) {
    const wall = board.walls[w];
    const nextsector = wall.nextsector;
    if (nextsector == -1 || sectors.has(nextsector)) continue;
    sectors.add(nextsector);
    innerSectors(board, nextsector, sectors);
  }
  return sectors;
}

export function innerSectors(board: Board, sectorId: number, sectors: Set<number> = new Set<number>()): Set<number> {
  const loops = loopPoints(board, sectorId);
  for (let loopoint of loops) loopInnerSectors(board, loopoint, sectors);
  return sectors;
}

function deleteSectors(board: Board, sectors: Iterable<number>, refs: BuildReferenceTracker) {
  track(refs.sectors, sectorRefs => {
    const secs = [...map(sectors, s => sectorRefs.ref(s))];
    for (let s of secs) deleteSector(board, sectorRefs.val(s), refs);
  });
}

export function deleteSectorFull(board: Board, sectorId: number, refs: BuildReferenceTracker) {
  const secs = [...innerSectors(board, sectorId), sectorId];
  deleteSectors(board, secs, refs);
}

export function deleteLoopFull(board: Board, wallId: number, refs: BuildReferenceTracker) {
  if (isOuterLoop(board, wallId)) throw new Error('Cannot delete outer loops');
  const sectors = new Set<number>();
  const loop = loopWalls(board, wallId);
  for (let w of loop) {
    const wall = board.walls[w];
    if (wall.nextsector == -1) continue;
    sectors.add(wall.nextsector);
    innerSectors(board, wall.nextsector, sectors);
  }
  track(refs.walls, wallRefs => {
    const wallref = wallRefs.ref(wallId);
    deleteSectors(board, sectors, refs);
    deleteLoop(board, wallRefs.val(wallref), refs);
  });
}

export function* wallsBetween(board: Board, from: number, to: number): Generator<Wall> {
  const walls = board.walls;
  for (let w = from; w != to; w = walls[w].point2) yield walls[w];
}

export function insertSprite(board: Board, x: number, y: number, z: number, sprite: Sprite = newSprite(0, 0, 0)) {
  const sectorId = findSector(board, x, y, -1);
  if (sectorId == -1) return -1;
  const spr = board.sprites[board.numsprites] = copySprite(sprite, x, y, z);
  spr.sectnum = sectorId;
  return board.numsprites++;
}

export function deleteSprite(board: Board, spriteId: number) {
  if (spriteId < 0 || spriteId >= board.numsprites) return;
  for (let i = spriteId; i < board.numsprites; i++) {
    board.sprites[i] = board.sprites[i + 1];
  }
  board.numsprites--;
}

function deleteWallImpl(board: Board, wallId: number) {
  const sectorId = sectorOfWall(board, wallId);
  const originalPoint2 = board.walls[wallId].point2;
  const point2 = originalPoint2 > wallId ? wallId : originalPoint2;
  for (let w = 0; w < board.numwalls; w++) {
    if (w == wallId) continue;
    const wall = board.walls[w];
    if (wall.nextwall == wallId) throw new Error(`Wall ${w} nextwall references to deleting wall ${wallId}`);
    if (wall.point2 == wallId) wall.point2 = point2;
    if (wall.point2 > wallId) wall.point2--;
    if (wall.nextwall > wallId) wall.nextwall--;
  }
  for (let i = wallId; i < board.numwalls - 1; i++) board.walls[i] = board.walls[i + 1];
  board.walls[board.numwalls - 1] = null;
  board.numwalls--;
  board.sectors[sectorId].wallnum--;
  for (let i = 0; i < board.numsectors; i++) {
    let sec = board.sectors[i];
    if (sec.wallptr > wallId) sec.wallptr--;
  }
}

export function isSectorTJunction(board: Board, wallId: number) {
  const wall = board.walls[wallId];
  const lwall = board.walls[lastwall(board, wallId)];
  return wall.nextsector != lwall.nextsector;
}

function deletedWallUpdater(wallId: number) {
  return (w: number) => {
    if (w == wallId) return -1
    else if (w > wallId) return w - 1;
    else return w;
  }
}

export function deleteWall(board: Board, wallId: number, refs: BuildReferenceTracker) {
  if (isSectorTJunction(board, wallId)) throw new Error(`Wall ${wallId} is sector T junction`);
  const loop = [...loopWalls(board, wallId)];
  if (loop.length < 4) throw new Error(`Loop of Wall ${wallId} need to have 3 walls at minimum`);
  const wall = board.walls[wallId];
  if (wall.nextsector != -1) {
    const loop = [...loopWalls(board, wall.nextwall)];
    if (loop.length < 4) throw new Error(`Loop of Wall ${wall.nextwall} need to have 3 walls minimum`);
    const wall2Id = board.walls[wall.nextwall].point2;
    const lastWallId = lastwall(board, wallId);
    board.walls[lastWallId].nextwall = wall.nextwall;
    board.walls[wall.nextwall].nextwall = lastWallId;
    wall.nextwall = -1;
    wall.nextsector = -1;
    deleteWallImpl(board, wall2Id);
    refs.walls.update(deletedWallUpdater(wall2Id));
    wallId += wallId > wall2Id ? -1 : 0;
  }
  deleteWallImpl(board, wallId);
  refs.walls.update(deletedWallUpdater(wallId));
}

export function mergePoints(board: Board, wallId: number, refs: BuildReferenceTracker) {
  let wall = board.walls[wallId];
  let wall2 = board.walls[wall.point2];
  if (wall.x == wall2.x && wall.y == wall2.y) deleteWall(board, wallId, refs);
}

const NULL_SECTOR_SET = new Set([-1]);
export function findSectorsAtPoint(board: Board, x: number, y: number): Set<number> {
  const sectorId = findSector(board, x, y);
  if (sectorId == -1) return NULL_SECTOR_SET;
  const wallId = wallInSector(board, sectorId, x, y);
  if (wallId == -1) return new Set([sectorId]);
  return new Set(iter(connectedWalls(board, wallId, new Deck()))
    .map(w => sectorOfWall(board, w)));
}

export function findContainingSector(board: Board, points: Iterable<[number, number]>) {
  return iter(points)
    .map(p => findSectorsAtPoint(board, p[0], p[1]))
    .reduce((lh, rh) => { return lh == null ? rh : intersect(lh, rh) }, null)
}

function pointInterpolator(lh: [number, number], rh: [number, number], t: number) {
  return <[number, number]>[NumberInterpolator(lh[0], rh[0], t), NumberInterpolator(lh[1], rh[1], t)]
}

export function findContainingSectorMidPoints(board: Board, points: Iterable<[number, number]>): Set<number> {
  const interpolated = interpolate(points, pointInterpolator);
  return findContainingSector(board, interpolated);
}