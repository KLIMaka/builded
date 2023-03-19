import { Entity, EntityType } from "../../build/hitscan";
import { Board } from "../../build/board/structs";
import { slope } from "../../build/utils";
import { tuple2 } from "../../utils/mathutils";
import { MessageBus } from "../apis/handler";
import { BoardInvalidate } from "./messages";

export function invalidateSectorAndWalls(sectorId: number, board: Board, bus: MessageBus) {
  bus.handle(new BoardInvalidate(Entity.ceiling(sectorId)));
  let sec = board.sectors[sectorId];
  let end = sec.wallnum + sec.wallptr;
  for (let w = sec.wallptr; w < end; w++) {
    bus.handle(new BoardInvalidate(Entity.wallPoint(w)));
    bus.handle(new BoardInvalidate(Entity.wallPoint(board.walls[w].nextwall)));
  }
}

let sectorZesult: [EntityType, number] = [null, 0];
export function getClosestSectorZ(board: Board, sectorId: number, x: number, y: number, z: number): [EntityType, number] {
  let sector = board.sectors[sectorId];
  let fz = slope(board, sectorId, x, y, sector.floorheinum) + sector.floorz;
  let cz = slope(board, sectorId, x, y, sector.ceilingheinum) + sector.ceilingz;
  return Math.abs(z - fz) < Math.abs(z - cz) ? tuple2(sectorZesult, EntityType.FLOOR, fz) : tuple2(sectorZesult, EntityType.CEILING, cz);
}

