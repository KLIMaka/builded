import { map } from "../../utils/collections";
import { loopPointsOrdered, loopWalls, sectorWalls } from "../board/loops";
import { Board } from "../board/structs";

type IdToIds = { [index: number]: number[] };
function ensure(id2ids: IdToIds, idx: number): number[] {
  let ids = id2ids[idx];
  if (ids == undefined) {
    ids = [];
    id2ids[idx] = ids;
  }
  return ids;
}

function getPortalsFromLoop(board: Board, loopId: number) {
  let portal = [];
  const portals = [];
  const loop = [...loopWalls(board, loopId)];
  const connected = board.walls[loop[0]].nextsector != -1;
  for (const w of loop) {
    const wall = board.walls[w];
    if (wall.nextsector == -1) {
      if (portal.length > 0) {
        portals.push(portal);
        portal = [];
      }
    } else {
      portal.push(w)
    }
  }
  if (portals.length == 0 && portal.length > 0 && connected) return [];
  if (portal.length > 0) portals.push(portal);
  if (connected) {
    portals[0] = portal.concat(portals[0]);
    portals.pop();
  }
  return portals;
}

export function getPortals(board: Board, sectorId: number) {
  return map(loopPointsOrdered(board, sectorId), w => [w, getPortalsFromLoop(board, w)]);
}

function foo(board: Board) {
  const clusters: IdToIds = {};
  for (let s = 0; s < board.numsectors; s++) {
    const connected = new Set<number>();
    connected.add(s);
    for (const w of sectorWalls(board, s)) {
      const wall = board.walls[w];
      if (wall.nextsector != -1) connected.add(wall.nextsector);
    }
    const cluster = [...connected].sort();
    clusters[s] = cluster;
  }
}