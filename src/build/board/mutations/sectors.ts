import { BuildReferenceTracker } from "../../../app/apis/app";
import { track } from "../../../app/apis/referencetracker";
import { any, chain, cyclicRange, Deck, enumerate, length, map, wrap } from "../../../utils/collections";
import { order } from "../../utils";
import { innerSectors, innerSectorsOfLoop, isOuterLoop, loopWalls } from "../loops";
import { sectorOfWall } from "../query";
import { Board, Wall } from "../structs";
import { EngineApi } from "./api";
import { createNewSector } from "./ceatesector";
import { deleteSector, moveWalls, resizeWalls } from "./internal";
import { SectorBuilder } from "./sectorbuilder";
import { fixxrepeat } from "./walls";

export function fillInnerLoop<B extends Board>(board: B, wallId: number, refs: BuildReferenceTracker, api: EngineApi<B>) {
  if (isOuterLoop(board, wallId)) throw new Error('Only inner loops can be filled');
  if (any(loopWalls(board, wallId), w => board.walls[w].nextsector != -1)) throw new Error(`Already filled`);
  const WALL_MAPPER = (w: number) => <[number, number]>[board.walls[w].x, board.walls[w].y];
  const points = wrap([...map(loopWalls(board, wallId), WALL_MAPPER)]);
  createNewSector(board, points, refs, api);
}

export function createInnerLoop<B extends Board>(board: B, sectorId: number, points: Iterable<[number, number]>, refs: BuildReferenceTracker, api: EngineApi<B>) {
  const sector = board.sectors[sectorId];
  const pointsLength = length(points);
  resizeWalls(board, sectorId, sector.wallnum + pointsLength, refs);
  const wallPtr = sector.wallptr + sector.wallnum - pointsLength;
  const firstWall = board.walls[sector.wallptr];
  points = order(points, false);
  for (const [[x, y], i] of enumerate(points)) {
    const wall = api.cloneWall(firstWall);
    wall.x = x;
    wall.y = y;
    wall.point2 = i == pointsLength - 1 ? wallPtr : wallPtr + i + 1;
    wall.nextsector = wall.nextwall = -1;
    board.walls[wallPtr + i] = wall;
  }
  for (let w = wallPtr; w < sector.wallptr + sector.wallnum; w++) fixxrepeat(board, w);
}

export function setFirstWall<B extends Board>(board: B, sectorId: number, newFirstWall: number, refs: BuildReferenceTracker) {
  const sector = board.sectors[sectorId];
  if (sector.wallptr == newFirstWall) return;
  const end = sector.wallptr + sector.wallnum;
  if (newFirstWall < sector.wallptr || newFirstWall >= end) throw new Error(`Wall ${newFirstWall} not in sector ${sectorId}`);
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

export function deleteLoop<B extends Board>(board: B, wallId: number, refs: BuildReferenceTracker) {
  if (isOuterLoop(board, wallId)) throw new Error('Cannot delete outer loops');
  const loop = [...loopWalls(board, wallId)];
  if (any(loop, w => board.walls[w].nextsector != -1)) throw new Error('Cannot delete filled loop');
  const sectorId = sectorOfWall(board, wallId);
  moveWalls(board, sectorId, loop[0], -loop.length, refs);
}

function deleteSectors<B extends Board>(board: B, sectors: Iterable<number>, refs: BuildReferenceTracker) {
  track(refs.sectors, sectorRefs => {
    const secs = [...map(sectors, s => sectorRefs.ref(s))];
    for (const s of secs) deleteSector(board, sectorRefs.val(s), refs);
  });
}

export function deleteSectorFull<B extends Board>(board: B, sectorId: number, refs: BuildReferenceTracker) {
  deleteSectors(board, chain(innerSectors(board, sectorId), [sectorId]), refs);
}

export function deleteLoopFull<B extends Board>(board: B, wallId: number, refs: BuildReferenceTracker) {
  deleteSectors(board, innerSectorsOfLoop(board, wallId), refs);
}
