import { BuildReferenceTracker } from '../../../app/apis/app';
import { sectorWalls } from '../loops';
import { SectorBuilder } from '../mutations/sectorbuilder';
import { isJoinedSectors } from '../query';
import { Board } from '../structs';
import { deleteSector } from './internal';

function fillSectorWalls(board: Board, s: number, set: Set<number>) { for (const w of sectorWalls(board, s)) set.add(w) }

const _wallset = new Set<number>();
function fillWallSet(board: Board, s1: number, s2: number) {
  _wallset.clear();
  fillSectorWalls(board, s1, _wallset);
  fillSectorWalls(board, s2, _wallset);
  return _wallset;
}

function getJoinedWallsLoops(board: Board, s1: number, s2: number): SectorBuilder {
  const builder = new SectorBuilder();
  const wallset = fillWallSet(board, s1, s2);
  const values = wallset.values();
  for (let it = values.next(); !it.done; it = values.next()) {
    let w = it.value;
    const loopstart = w;
    for (; ;) {
      wallset.delete(w);
      const wall = board.walls[w];
      if (wall.nextsector == s1 || wall.nextsector == s2) {
        wallset.delete(wall.nextwall);
        w = board.walls[wall.nextwall].point2;
      } else {
        builder.addWall(wall);
        w = wall.point2;
      }
      if (w == loopstart) {
        builder.loop();
        break;
      }
    }
  }
  return builder;
}

export function joinSectors(board: Board, s1: number, s2: number, refs: BuildReferenceTracker) {
  if (!isJoinedSectors(board, s1, s2)) return -1;
  getJoinedWallsLoops(board, s1, s2).build(board, s1, refs);
  deleteSector(board, s2, refs);
  return 0;
}