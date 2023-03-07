import { BuildReferenceTracker } from "../../../app/apis/app";
import { vec3 } from "gl-matrix";
import { forEach, length } from "../../../utils/collections";
import { cross2d, int } from "../../../utils/mathutils";
import { ArtInfoProvider } from "../../formats/art";
import { wallNormal } from "../../utils";
import { connectedWalls, loopWalls } from "../loops";
import { walllen, sectorOfWall, lastwall, isValidWallId, nextwall, isTJunction } from "../query";
import { Board, Wall } from "../structs";
import { DEFAULT_REPEAT_RATE, moveWalls } from "./internal";
import { EngineApi } from "./api";
import { track } from "../../../app/apis/referencetracker";

export function fixxrepeat(board: Board, wallId: number, reprate: number = DEFAULT_REPEAT_RATE) {
  const wall = board.walls[wallId];
  wall.xrepeat = Math.min(255, Math.max(1, Math.round((walllen(board, wallId) + 0.5) / reprate)))
}

function fixpoint2xpan(board: Board, wallId: number, art: ArtInfoProvider) {
  const wall = board.walls[wallId];
  const wall2 = board.walls[wall.point2];
  wall2.xpanning = ((wall.xpanning + (wall.xrepeat << 3)) % art.getInfo(wall.picnum).w) & 0xff;
}

function insertWall(board: Board, wallId: number, x: number, y: number, art: ArtInfoProvider, refs: BuildReferenceTracker, cloneWall: (w: Wall) => Wall) {
  const secId = sectorOfWall(board, wallId);
  const wall = board.walls[wallId];
  const lenperrep = walllen(board, wallId) / Math.max(wall.xrepeat, 1);
  moveWalls(board, secId, wallId, 1, refs);
  const nwall = cloneWall(wall);
  nwall.x = x;
  nwall.y = y;
  board.walls[wallId + 1] = nwall;
  wall.point2 = wallId + 1;
  fixxrepeat(board, wallId, lenperrep);
  fixpoint2xpan(board, wallId, art);
  fixxrepeat(board, wallId + 1, lenperrep);
}

export function splitWall(board: Board, wallId: number, x: number, y: number, art: ArtInfoProvider, refs: BuildReferenceTracker, cloneWall: (w: Wall) => Wall): number {
  if (!isValidWallId(board, wallId)) throw new Error('Invalid wall: ' + wallId);
  const wall = board.walls[wallId];
  insertWall(board, wallId, x, y, art, refs, cloneWall);
  if (wall.nextwall != -1) {
    const nextwallId = wall.nextwall;
    insertWall(board, nextwallId, x, y, art, refs, cloneWall);
    const wallId = board.walls[nextwallId].nextwall;
    board.walls[wallId].nextwall = nextwallId + 1;
    board.walls[wallId + 1].nextwall = nextwallId;
    board.walls[nextwallId].nextwall = wallId + 1;
    board.walls[nextwallId + 1].nextwall = wallId;
    return wallId;
  }
  return wallId;
}

function doMoveWall(board: Board, w: number, x: number, y: number) {
  board.walls[w].x = x;
  board.walls[w].y = y;
  fixxrepeat(board, w);
  fixxrepeat(board, lastwall(board, w));
}

export function moveWall(board: Board, wallId: number, x: number, y: number): boolean {
  const wall = board.walls[wallId];
  if (wall.x == x && wall.y == y) return false;
  forEach(connectedWalls(board, wallId), w => doMoveWall(board, w, x, y));
  return true;
}


const _wallNormal = vec3.create();
export function pushWall(board: Board, wallId: number, len: number, art: ArtInfoProvider, alwaysNewPoints = false, refs: BuildReferenceTracker, api: EngineApi) {
  if (len == 0) return wallId;
  let w1 = wallId;
  const wall1 = board.walls[w1];
  let w2 = wall1.point2;
  const wall2 = board.walls[w2];
  const p1 = lastwall(board, w1);
  const prev1 = board.walls[p1];
  const n2 = wall2.point2;
  const next2 = board.walls[n2];
  const normal = wallNormal(_wallNormal, board, wallId);
  const [nx, _, ny] = vec3.scale(normal, normal, len);
  const x1 = int(wall1.x + nx);
  const y1 = int(wall1.y + ny);
  const x2 = int(wall2.x + nx);
  const y2 = int(wall2.y + ny);

  if (alwaysNewPoints) {
    w1 = splitWall(board, w1, x1, y1, art, refs, api.cloneWall);
    w2 = nextwall(board, w1);
    splitWall(board, w2, x2, y2, art, refs, api.cloneWall);
    return;
  }

  const extent1 = cross2d(x1 - prev1.x, y1 - prev1.y, wall1.x - prev1.x, wall1.y - prev1.y) == 0;
  const extent2 = cross2d(x2 - next2.x, y2 - next2.y, wall2.x - next2.x, wall2.y - next2.y) == 0;

  if (extent1 && extent2) {
    moveWall(board, w1, x1, y1);
    moveWall(board, w2, x2, y2);
  } else if (extent1 && !extent2) {
    moveWall(board, w1, x1, y1);
    splitWall(board, w1, x2, y2, art, refs, api.cloneWall);
  } else if (!extent1 && extent2) {
    w1 = splitWall(board, w1, x1, y1, art, refs, api.cloneWall);
    w2 = nextwall(board, nextwall(board, w1));
    moveWall(board, w2, x2, y2);
  } else if (!extent1 && !extent2) {
    w1 = splitWall(board, w1, x1, y1, art, refs, api.cloneWall);
    w2 = nextwall(board, w1);
    splitWall(board, w2, x2, y2, art, refs, api.cloneWall);
  }
}

export function deleteWall(board: Board, wallId: number, refs: BuildReferenceTracker) {
  if (!isValidWallId(board, wallId)) throw new Error(`Invalid wallId: ${wallId}`);
  if (isTJunction(board, wallId)) throw new Error(`Wall ${wallId} is sector T junction`);
  if (length(loopWalls(board, wallId)) < 4) throw new Error(`Loop of Wall ${wallId} need to have 3 walls at minimum`);
  const sectorId = sectorOfWall(board, wallId);
  const wall = board.walls[wallId];
  track(refs.walls, wrefs => {
    const refwall = wrefs.ref(lastwall(board, wallId));
    if (wall.nextsector != -1) {
      if (length(loopWalls(board, wall.nextwall)) < 4) throw new Error(`Loop of Wall ${wall.nextwall} need to have 3 walls minimum`);
      const refnextwall = wrefs.ref(lastwall(board, wall.nextwall));
      const nextwall = board.walls[wall.nextwall];
      const wall2Id = nextwall.point2;
      const lastWallId = lastwall(board, wallId);
      board.walls[lastWallId].nextwall = wall.nextwall;
      nextwall.nextwall = lastWallId;
      if (board.walls[wall2Id].point2 < wall2Id) board.walls[wall2Id - 1].point2 = board.walls[wall2Id].point2;
      moveWalls(board, wall.nextsector, wall2Id, -1, refs);
      fixxrepeat(board, wrefs.val(refnextwall));
      wall.nextwall = -1;
      wall.nextsector = -1;
      wallId += wallId > wall2Id ? -1 : 0;
    }
    if (wall.point2 < wallId) board.walls[wallId - 1].point2 = wall.point2;
    moveWalls(board, sectorId, wallId, -1, refs);
    fixxrepeat(board, wrefs.val(refwall));
  });
}

export function mergePoints(board: Board, wallId: number, refs: BuildReferenceTracker) {
  const wall = board.walls[wallId];
  const wall2 = board.walls[wall.point2];
  if (wall.x == wall2.x && wall.y == wall2.y) deleteWall(board, wallId, refs);
}
