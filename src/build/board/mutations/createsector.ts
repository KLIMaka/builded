import { BuildReferenceTracker } from "../../../app/apis/app";
import { Collection, enumerate, loopPairs, wrap } from "../../../utils/collections";
import { iter } from "../../../utils/iter";
import { order } from "../../utils";
import { Board, Sector, Wall } from "../structs";
import { BoardSector, BoardWall, EngineApi } from "./api";
import { addSector } from "./internal";
import { SectorBuilder } from "./sectorbuilder";
import { fixxrepeat } from "./walls";

function searchMatchWall(board: Board, p1: [number, number], p2: [number, number]): [number, number] {
  for (let s = 0; s < board.numsectors; s++) {
    const sec = board.sectors[s];
    const end = sec.wallptr + sec.wallnum;
    for (let w = sec.wallptr; w < end; w++) {
      const wall1 = board.walls[w];
      if (wall1 == null || wall1.nextwall != -1) continue;
      const wall2 = board.walls[wall1.point2];
      if (wall1.x == p2[0] && wall1.y == p2[1] && wall2.x == p1[0] && wall2.y == p1[1]) {
        return [s, w];
      }
    }
  }
  return null;
}

function matchWalls(board: Board, points: Iterable<[number, number]>): [number, number][] {
  return iter(loopPairs(points)).map(([p1, p2]) => searchMatchWall(board, p1, p2)).collect();
}

function commonSectorWall<B extends Board>(board: B, matched: [number, number][], api: EngineApi<B>): [BoardSector<B>, BoardWall<B>] {
  for (let m of matched) if (m != null) return [board.sectors[m[0]], board.walls[m[1]]];
  return [api.newSector(), api.newWall()];
}

function* createNewWalls(points: Iterable<[number, number]>, matchedWalls: [number, number][], commonWall: Wall, board: Board, cloneWall: (w: Wall) => Wall): Generator<Wall> {
  for (const [[x, y], i] of enumerate(points)) {
    const matchedWall = matchedWalls[i];
    const baseWall = matchedWall == null ? commonWall : board.walls[matchedWall[1]];
    const wall = cloneWall(baseWall);
    wall.x = x;
    wall.y = y;
    if (matchedWall != null) {
      wall.nextwall = matchedWall[1];
      wall.nextsector = matchedWall[0];
    } else {
      wall.nextwall = -1;
      wall.nextsector = -1;
    }
    yield wall;
  }
}

export function createNewSector<B extends Board>(board: B, points: Collection<[number, number]>, refs: BuildReferenceTracker, api: EngineApi<B>) {
  points = wrap([...order(points)]);
  const mwalls = matchWalls(board, points);
  const [commonSector, commonWall] = commonSectorWall(board, mwalls, api);
  const sector = api.cloneSector(commonSector);
  const sectorId = addSector(board, sector);
  const walls = createNewWalls(points, mwalls, commonWall, board, api.cloneWall);
  new SectorBuilder().addLoop(walls).build(board, sectorId, refs);
  for (let w = sector.wallptr; w < sector.wallptr + sector.wallnum; w++) fixxrepeat(board, w);
  return sectorId;
}
