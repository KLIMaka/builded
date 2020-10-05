import { any, findFirst, interpolate, intersect, range } from "../../utils/collections";
import { NumberInterpolator } from "../../utils/interpolator";
import { iter } from "../../utils/iter";
import { cross2d, int, len2d } from "../../utils/mathutils";
import { connectedWalls, sectorWalls } from "./loops";
import { Board } from "./structs";

export function isValidWallId(board: Board, wallId: number): boolean {
  return wallId >= 0 && wallId < board.numwalls;
}

export function isValidSectorId(board: Board, sectorId: number): boolean {
  return sectorId >= 0 && sectorId < board.numsectors;
}

export function isValidSpriteId(board: Board, spriteId: number): boolean {
  return spriteId >= 0 && spriteId < board.numsprites;
}

export function wallInSector(board: Board, sectorId: number, x: number, y: number) {
  return findFirst(sectorWalls(board, sectorId), w => board.walls[w].x == x && board.walls[w].y == y, -1);
}

export function walllen(board: Board, wallId: number) {
  if (!isValidWallId(board, wallId)) throw new Error(`Invalid wallId: ${wallId}`);
  const wall = board.walls[wallId];
  const wall2 = board.walls[wall.point2];
  const dx = wall2.x - wall.x;
  const dy = wall2.y - wall.y;
  return len2d(dx, dy);
}

export function lastwall(board: Board, wallId: number): number {
  if (!isValidWallId(board, wallId)) throw new Error(`Invalid wallId: ${wallId}`);
  if (wallId > 0 && board.walls[wallId - 1].point2 == wallId) return wallId - 1;
  for (let w = wallId; ; w = board.walls[w].point2) {
    if (board.walls[w].point2 == wallId) return w;
  }
}

export function nextwall(board: Board, wallId: number): number {
  if (!isValidWallId(board, wallId)) throw new Error(`Invalid wallId: ${wallId}`);
  return board.walls[wallId].point2;
}

export function isJoinedSectors(board: Board, sectorId1: number, sectorId2: number) {
  return any(sectorWalls(board, sectorId1), w => board.walls[w].nextsector == sectorId2);
}

export function isTJunction(board: Board, wallId: number) {
  if (!isValidWallId(board, wallId)) throw new Error(`Invalid wallId: ${wallId}`);
  const wall = board.walls[wallId];
  const lwall = board.walls[lastwall(board, wallId)];
  return wall.nextsector != lwall.nextsector;
}

const NULL_SECTOR_SET = new Set([-1]);
export function findSectorsAtPoint(board: Board, x: number, y: number): Set<number> {
  const sectorId = findSector(board, x, y);
  if (sectorId == -1) return NULL_SECTOR_SET;
  const wallId = wallInSector(board, sectorId, x, y);
  if (wallId == -1) return new Set([sectorId]);
  return new Set(iter(connectedWalls(board, wallId))
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

export function inSector(board: Board, x: number, y: number, sectorId: number): boolean {
  if (sectorId < 0 || sectorId >= board.numsectors) return false;
  x = int(x);
  y = int(y);
  let inter = 0;
  for (const w of sectorWalls(board, sectorId)) {
    const wall = board.walls[w];
    const wall2 = board.walls[wall.point2];
    const dy1 = wall.y - y;
    const dy2 = wall2.y - y;
    const dx1 = wall.x - x;
    const dx2 = wall2.x - x;
    if (dx1 == 0 && dx2 == 0 && (dy1 == 0 || dy2 == 0 || (dy1 ^ dy2) < 0)) return true;
    if (dy1 == 0 && dy2 == 0 && (dx1 == 0 || dx2 == 0 || (dx1 ^ dx2) < 0)) return true;

    if ((dy1 ^ dy2) < 0) {
      if ((dx1 ^ dx2) >= 0)
        inter ^= dx1;
      else
        inter ^= cross2d(dx1, dy1, dx2, dy2) ^ dy2;
    }
  }
  return (inter >>> 31) == 1;
}

export function sectorOfWall(board: Board, wallId: number): number {
  if (wallId < 0 || wallId >= board.numwalls) return -1;
  const wall = board.walls[wallId];
  if (wall.nextwall != -1) return board.walls[wall.nextwall].nextsector;
  let start = 0;
  let end = board.numsectors - 1;
  while (end - start >= 0) {
    const pivot = int(start + (end - start) / 2);
    const sec = board.sectors[pivot];
    if (sec.wallptr <= wallId && sec.wallptr + sec.wallnum - 1 >= wallId) return pivot;
    if (sec.wallptr > wallId) end = pivot - 1;
    else start = pivot + 1;
  }
}

export function findSector(board: Board, x: number, y: number, sectorId: number = -1): number {
  if (!isValidSectorId(board, sectorId)) return findSectorAll(board, x, y);
  const secs = [sectorId];
  for (let i = 0; i < secs.length; i++) {
    sectorId = secs[i];
    const sec = board.sectors[sectorId];
    if (inSector(board, x, y, sectorId)) return sectorId;
    for (let w = 0; w < sec.wallnum; w++) {
      const wallidx = w + sec.wallptr;
      const wall = board.walls[wallidx];
      if (wall.nextsector != -1) {
        const nextsector = wall.nextsector;
        if (secs.indexOf(nextsector) == -1)
          secs.push(nextsector);
      }
    }
  }
  return -1;
}

function findSectorAll(board: Board, x: number, y: number) {
  return findFirst(range(0, board.numsectors), s => inSector(board, x, y, s), -1);
}