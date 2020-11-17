import { BuildReferenceTracker } from '../../../app/apis/app';
import { sectorWalls } from '../loops';
import { SectorBuilder } from '../mutations/sectorbuilder';
import { isJoinedSectors } from '../query';
import { Board } from '../structs';
import { EngineApi } from './api';
import { deleteSector } from './internal';

function fillWallSet(board: Board, s1: number, s2: number) {
  const wallset = new Set<number>();
  for (const w of sectorWalls(board, s1)) if (board.walls[w].nextsector != s2) wallset.add(w);
  for (const w of sectorWalls(board, s2)) if (board.walls[w].nextsector != s1) wallset.add(w);
  return wallset;
}

function getJoinedWallsLoops(board: Board, s1: number, s2: number, api: EngineApi): SectorBuilder {
  const builder = new SectorBuilder();
  const wallset = fillWallSet(board, s1, s2);
  for (const loopstart of wallset.values()) {
    let w = loopstart;
    do {
      wallset.delete(w);
      const wall = board.walls[w];
      if (wall.nextsector == s1 || wall.nextsector == s2) {
        w = board.walls[wall.nextwall].point2;
      } else {
        builder.addWall(wall);
        if (wall.nextwall != -1) board.walls[wall.nextwall].nextsector = s1;
        w = wall.point2;
      }
    } while (w != loopstart)
    builder.loop();
  }
  const nullWall = api.newWall();
  for (const w of sectorWalls(board, s2)) board.walls[w] = nullWall;
  return builder;
}

export function joinSectors(board: Board, s1: number, s2: number, refs: BuildReferenceTracker, api: EngineApi) {
  if (!isJoinedSectors(board, s1, s2)) throw new Error(`Sectors ${s1} and ${s2} is not connected`);
  getJoinedWallsLoops(board, s1, s2, api).build(board, s1, refs);
  deleteSector(board, s2, refs);
}