import { range } from "../../utils/collections";
import { iter } from "../../utils/iter";
import { eq, len2d, lenPointToLine, lse } from "../../utils/mathutils";
import { findSector } from "../utils";
import { sectorWalls } from "./loops";
import { Board } from "./structs";

export function distanceToWallSegment(board: Board, wallId: number, x: number, y: number): number {
  const wall = board.walls[wallId];
  const wall2 = board.walls[wall.point2];
  return lenPointToLine(x, y, wall.x, wall.y, wall2.x, wall2.y);
}

export function distanceToWallPoint(board: Board, wallId: number, x: number, y: number): number {
  const wall = board.walls[wallId];
  return len2d(x - wall.x, y - wall.y);
}

function distance(ids: Iterable<number>, distf: (ent: number) => number): [number, number] {
  let id = -1;
  let mindist = Number.MAX_VALUE;
  for (const i of ids) {
    const dist = distf(i);
    if (dist < mindist) {
      id = i;
      mindist = dist;
    }
  }
  return [id, mindist];
}

export function closestWallPointDist(board: Board, x: number, y: number): [number, number] {
  return distance(range(0, board.numwalls), w => distanceToWallPoint(board, w, x, y));
}

export function closestWallPoint(board: Board, x: number, y: number, d: number): number {
  const [w, dist] = closestWallPointDist(board, x, y);
  return lse(dist, d) ? w : -1;
}

export function closestWallInSectorDist(board: Board, sectorId: number, x: number, y: number): [number, number] {
  return distance(sectorWalls(board, sectorId), w => distanceToWallPoint(board, w, x, y));
}

export function closestWallInSector(board: Board, sectorId: number, x: number, y: number, d: number): number {
  const [w, dist] = closestWallInSectorDist(board, sectorId, x, y);
  return lse(dist, d) ? w : -1;
}

export function closestWallSegmentInSectorDist(board: Board, sectorId: number, x: number, y: number): [number, number] {
  return distance(sectorWalls(board, sectorId), w => distanceToWallSegment(board, w, x, y));
}

export function closestWallSegmentInSector(board: Board, sectorId: number, x: number, y: number, d: number): number {
  const [w, dist] = closestWallSegmentInSectorDist(board, sectorId, x, y);
  return lse(dist, d) ? w : -1;
}

export function closestSpriteInSectorDist(board: Board, secId: number, x: number, y: number): [number, number] {
  const sprites = board.sprites;
  return distance(iter(range(0, board.numsprites)).filter(s => sprites[s].sectnum == secId), s => len2d(sprites[s].x - x, sprites[s].y - y));
}

export function closestSpriteInSector(board: Board, secId: number, x: number, y: number, d: number): number {
  const [s, dist] = closestSpriteInSectorDist(board, secId, x, y);
  return lse(dist, d) ? s : -1;
}

export function closestWallSegmentDist(board: Board, x: number, y: number): [number, number] {
  const sectorId = findSector(board, x, y);
  let wallId = -1;
  let mindist = Number.MAX_VALUE;
  for (let w = 0; w < board.numwalls; w++) {
    const dist = distanceToWallSegment(board, w, x, y);
    if (eq(mindist, dist)) {
      const wall = board.walls[wallId];
      wallId = wall.nextsector == sectorId ? w : wallId;
    } else if (dist < mindist) {
      mindist = dist;
      wallId = w;
    }
  }
  return [wallId, mindist];
}

export function closestWallSegment(board: Board, x: number, y: number, d: number): number {
  const [w, dist] = closestWallSegmentDist(board, x, y);
  return lse(dist, d) ? w : -1;
}