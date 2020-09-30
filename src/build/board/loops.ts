import { Collection, Deck, IndexedDeck, wrap } from "../../utils/collections";
import { iter } from "../../utils/iter";
import { lastwall, nextwall } from "../boardutils";
import { clockwise } from "./internal";
import { Board } from "./structs";

export function* sectorWalls(board: Board, sectorId: number): Generator<number> {
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
  if (wallId < 0 || wallId >= board.numwalls) throw new Error(`Invalid wall ${wallId}`);
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

export function loopInnerSectors(board: Board, wallId: number, sectors: Set<number> = new Set<number>()): Set<number> {
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
  for (const loopoint of loopPoints(board, sectorId)) loopInnerSectors(board, loopoint, sectors);
  return sectors;
}

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

export function isOuterLoop(board: Board, wallId: number) {
  const WALL_MAPPER = (w: number) => <[number, number]>[board.walls[w].x, board.walls[w].y];
  return clockwise(iter(loopWalls(board, wallId)).map(WALL_MAPPER));
}

const _connectedSet = new Set<number>();
export function connectedWalls(board: Board, wallId: number, result: Deck<number>): Deck<number> {
  _connectedSet.clear();
  const walls = board.walls;
  let counter = 0;
  let w = wallId;
  _connectedSet.add(w);
  do {
    const wall = walls[w];
    if (wall.nextwall != -1) {
      w = nextwall(board, wall.nextwall);
      _connectedSet.add(w);
    } else {
      w = wallId;
      do {
        const last = lastwall(board, w);
        const wall = walls[last];
        if (wall.nextwall != -1) {
          w = wall.nextwall;
          _connectedSet.add(w);
        } else break;
      } while (w != wallId)
    }
    counter++;
    if (counter > board.numwalls) throw new Error('Cycled connected walls');
  } while (w != wallId)
  return result.pushAll(_connectedSet);
}