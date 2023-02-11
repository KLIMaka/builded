import { forEach, map } from "../../utils/collections";
import { minValue } from "../../utils/mathutils";
import { clockwise, slope } from "../utils";
import { isValidSectorId, isValidWallId, lastwall, nextwall, sectorOfWall } from "./query";
import { Board } from "./structs";

export function* sectorWalls(board: Board, sectorId: number): Generator<number> {
  if (!isValidSectorId(board, sectorId)) throw new Error(`Invalid sectorId: ${sectorId}`);
  const sector = board.sectors[sectorId];
  const end = sector.wallnum + sector.wallptr;
  for (let w = sector.wallptr; w < end; w++) yield w;
}

export function* loopPoints(board: Board, sectorId: number): Generator<number> {
  for (const w of sectorWalls(board, sectorId)) {
    const wall = board.walls[w];
    if (w > wall.point2) yield w;
  }
}

export function* loopWalls(board: Board, wallId: number): Generator<number> {
  const start = loopStart(board, wallId);
  yield start;
  for (let w = board.walls[start].point2; w != start; w = board.walls[w].point2) yield w;
}

export function loopStart(board: Board, wallId: number): number {
  if (!isValidWallId(board, wallId)) throw new Error(`Invalid wallId: ${wallId}`);
  if (wallId > board.walls[wallId].point2) return board.walls[wallId].point2;
  for (let w = board.walls[wallId].point2; w != wallId; w = board.walls[w].point2) {
    const wall = board.walls[w];
    if (w > wall.point2) return wall.point2;
  }
  throw new Error(`Corrupted Board`);
}

export function* wallsBetween(board: Board, from: number, to: number): Generator<number> {
  if (loopStart(board, from) != loopStart(board, to)) throw new Error(`Walls ${from} and ${to} not from one loop`);
  for (let w = from; w != to; w = board.walls[w].point2) yield w;
}

export function innerSectorsOfLoop(board: Board, wallId: number, sectors: Set<number> = new Set<number>()): Set<number> {
  if (isOuterLoop(board, wallId)) return sectors;
  for (const w of loopWalls(board, wallId)) {
    const wall = board.walls[w];
    const nextsector = wall.nextsector;
    if (nextsector == -1 || sectors.has(nextsector)) continue;
    sectors.add(nextsector);
    innerSectors(board, nextsector, sectors);
  }
  return sectors;
}

export function innerSectors(board: Board, sectorId: number, sectors: Set<number> = new Set<number>()): Set<number> {
  for (const loopoint of loopPoints(board, sectorId)) innerSectorsOfLoop(board, loopoint, sectors);
  return sectors;
}

export function innerWalls(board: Board, wallId: number): Iterable<number> {
  const loop = new Set<number>(loopWalls(board, wallId));
  for (const isec of innerSectorsOfLoop(board, wallId)) {
    for (const w of sectorWalls(board, isec)) {
      loop.add(w);
    }
  }
  return loop;
}

export function isOuterLoop(board: Board, wallId: number) {
  const wallMapper = (w: number) => <[number, number]>[board.walls[w].x, board.walls[w].y];
  return clockwise(map(loopWalls(board, wallId), wallMapper));
}

export function loopPointsOrdered(board: Board, sectorId: number): number[] {
  const loops = [];
  for (const loopId of loopPoints(board, sectorId)) {
    if (isOuterLoop(board, loopId)) loops.unshift(loopId)
    else loops.push(loopId);
  }
  return loops;
}

export function canonicalWall(board: Board, wallId: number): number {
  const canonical = minValue(wallId);
  forEach(connectedWalls(board, wallId), w => canonical.set(w));
  return canonical.get();
}

export function connectedWalls(board: Board, wallId: number, result = new Set<number>()): Iterable<number> {
  const walls = board.walls;
  let counter = 0;
  let w = wallId;
  result.add(w);
  do {
    const wall = walls[w];
    if (wall.nextwall != -1) {
      w = nextwall(board, wall.nextwall);
      result.add(w);
    } else {
      w = wallId;
      do {
        const last = lastwall(board, w);
        const wall = walls[last];
        if (wall.nextwall != -1) {
          w = wall.nextwall;
          result.add(w);
        } else break;
      } while (w != wallId)
    }
    counter++;
    if (counter > board.numwalls) throw new Error('Cycled connected walls');
  } while (w != wallId)
  return result;
}

export function samePicnumWalls(board: Board, wallId: number) {
  const wall = board.walls[wallId];
  const refPic = wall.picnum;
  const visited = new Set<number>();
  const result = new Set<number>();
  result.add(wallId);
  const visitor = (wallId: number) => {
    if (visited.has(wallId)) return;
    visited.add(wallId);
    const wall = board.walls[wallId];
    const sectorId = sectorOfWall(board, wallId);
    const sector = board.sectors[sectorId];
    const nextsectorId = wall.nextsector;
    if (nextsectorId != -1) {
      const nextsector = board.sectors[nextsectorId];
      const cz = slope(board, sectorId, wall.x, wall.y, sector.ceilingheinum) + sector.ceilingz;
      const fz = slope(board, sectorId, wall.x, wall.y, sector.floorheinum) + sector.floorz;
      const cnz = slope(board, nextsectorId, wall.x, wall.y, nextsector.ceilingheinum) + nextsector.ceilingz;
      const fnz = slope(board, nextsectorId, wall.x, wall.y, nextsector.floorheinum) + nextsector.floorz;
      if (cnz <= cz && fnz >= fz) return;
    }
    if (wall.picnum != refPic) return;
    result.add(wallId);
    for (const w of connectedWalls(board, wall.point2)) visitor(w);
  }
  for (const w of connectedWalls(board, wall.point2)) visitor(w);
  return result;
}