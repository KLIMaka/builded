import { BuildReferenceTracker } from '../../../app/apis/app';
import { all, Collection, enumerate, first, last, map, range, reversed, wrap } from '../../../utils/collections';
import { iter } from '../../../utils/iter';
import { Board, Wall } from '../structs';
import { clockwise, inPolygon } from '../../utils';
import { loopPoints, loopStart, loopWalls, wallsBetween } from '../loops';
import { SectorBuilder } from './sectorbuilder';
import { wallInSector } from '../query';
import { EngineApi, WallCloner } from './api';
import { addSector } from './internal';

type point2d = [number, number];

function* createNewWalls(points: Iterable<[number, number]>, matchWalls: [number, number][], commonWall: Wall, board: Board, cloneWall: WallCloner): Generator<Wall> {
  for (const [p, i] of enumerate(points)) {
    const matchWall = matchWalls[i];
    const baseWall = matchWall == null ? commonWall : board.walls[matchWall[1]];
    const wall = cloneWall(baseWall)
    wall.x = p[0];
    wall.y = p[1];
    if (matchWall != null) {
      wall.nextwall = matchWall[1];
      wall.nextsector = matchWall[0];
    } else {
      wall.nextwall = -1;
      wall.nextsector = -1;
    }
    yield wall;
  }
}

function loopInPolygon(board: Board, loopId: number, polygon: Iterable<point2d>) {
  return all(loopWalls(board, loopId), w => inPolygon(board.walls[w].x, board.walls[w].y, polygon));
}

function checkSplitSector(board: Board, sectorId: number, points: Collection<point2d>): [number, number, number] {
  const [fx, fy] = first(points);
  const [lx, ly] = last(points);
  const firstWall = wallInSector(board, sectorId, fx, fy);
  const lastWall = wallInSector(board, sectorId, lx, ly);
  if (firstWall == -1 || lastWall == -1) throw new Error(`Terminal points [${fx}, ${fy}], [${lx}, ${ly}] dont touch sector ${sectorId} walls`);
  const start = loopStart(board, firstWall);
  if (start != loopStart(board, lastWall)) throw new Error(`Start ${firstWall} and end ${lastWall} walls in different loops`);
  return [firstWall, lastWall, start];
}

function splitSectorImpl(board: Board, sectorId: number, firstWall: number, lastWall: number, start: number, points: Collection<point2d>, refs: BuildReferenceTracker, api: EngineApi) {
  const WALL_MAPPER = (w: number) => board.walls[w];
  const refWall = board.walls[firstWall];
  const lengthWoLast = points.length() - 1;
  const [newWalls, existedWalls, loopPoly] = getSplitLoop(board, firstWall, lastWall, points, api.cloneWall);
  const oldSectorBuilder = new SectorBuilder();
  const newSectorBuilder = new SectorBuilder()
    .addWalls(existedWalls)
    .addWalls(createNewWalls(newWalls, [], refWall, board, api.cloneWall))
    .loop();
  const firstLoopLength = newSectorBuilder.getWalls().length();

  for (const lid of loopPoints(board, sectorId)) {
    if (loopStart(board, lid) == start) continue;
    else (loopInPolygon(board, lid, loopPoly) ? newSectorBuilder : oldSectorBuilder).addLoop(map(loopWalls(board, lid), WALL_MAPPER));
  }
  const newSectorId = addSector(board, api.cloneSector(board.sectors[sectorId]));
  newSectorBuilder.build(board, newSectorId, refs);
  const newSector = board.sectors[newSectorId];
  const wallEnd = newSector.wallptr + firstLoopLength - 1;
  const mwalls = iter(range(wallEnd, wallEnd - lengthWoLast)).map(w => <point2d>[newSectorId, w]).collect();
  const reversedWoLast = iter(reversed(points)).take(lengthWoLast);
  oldSectorBuilder
    .addWalls(createNewWalls(reversedWoLast, mwalls, refWall, board, api.cloneWall))
    .addWalls(iter(wallsBetween(board, firstWall, lastWall)).map(w => board.walls[w]))
    .loop();
  // const usedWalls = iter(sectorWalls(board, newSectorId)).map(WALL_MAPPER).collect();
  // iter(sectorWalls(board, sectorId))
  //   .filter(w => usedWalls.includes(board.walls[w]))
  //   .forEach(w => board.walls[w] = null);
  oldSectorBuilder.build(board, sectorId, refs);
  return newSectorId;
}

const POINT_MAPPER = (w: Wall) => <point2d>[w.x, w.y];
function getSplitLoop(board: Board, firstWall: number, lastWall: number, points: Iterable<point2d>, cloneWall: WallCloner): [Iterable<point2d>, Iterable<Wall>, Iterable<point2d>] {
  const newWalls = iter(points).butLast().collect();
  const existedWalls = [...iter(wallsBetween(board, lastWall, firstWall)).map(w => cloneWall(board.walls[w]))];
  const loopPoly = iter(map(existedWalls, POINT_MAPPER)).chain(newWalls).collect();
  return [newWalls, existedWalls, loopPoly];
}

function checkPointsOrder(board: Board, firstWall: number, lastWall: number, points: Collection<point2d>, cloneWall: WallCloner): boolean {
  const [, , loop] = getSplitLoop(board, firstWall, lastWall, points, cloneWall);
  return clockwise(loop);
}

export function splitSector(board: Board, sectorId: number, points: Collection<point2d>, refs: BuildReferenceTracker, api: EngineApi) {
  const [firstWall, lastWall, loop] = checkSplitSector(board, sectorId, points);
  if (checkPointsOrder(board, firstWall, lastWall, points, api.cloneWall))
    return splitSectorImpl(board, sectorId, firstWall, lastWall, loop, points, refs, api);
  else
    return splitSectorImpl(board, sectorId, lastWall, firstWall, loop, wrap([...reversed(points)]), refs, api);
}