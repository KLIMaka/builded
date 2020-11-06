import { map } from "../../utils/collections";
import { loopPointsOrdered, loopWalls, sectorWalls } from "../board/loops";
import { Board } from "../board/structs";

export type Loop = { readonly looppoint: number, readonly portals: number[][] }

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

export function getPortals(board: Board, sectorId: number): Generator<Loop> {
  return map(loopPointsOrdered(board, sectorId), w => <Loop>{ looppoint: w, portals: getPortalsFromLoop(board, w) });
}
