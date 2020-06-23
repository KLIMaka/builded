import { BuildReferenceTracker } from '../../app/apis/app';
import { Collection, first, last, map, range, reversed, wrap } from '../../utils/collections';
import { iter } from '../../utils/iter';
import { Board, Wall } from '../board/structs';
import { inPolygon, sectorWalls } from '../utils';
import { addSector, clockwise, copySector, createNewWalls, loopPoints, loopStart, loopWalls, SectorBuilder, wallInSector, wallsBetween } from './internal';

type point2d = [number, number];

function loopInPolygon(board: Board, loopId: number, polygon: Iterable<point2d>) {
  for (const w of loopWalls(board, loopId)) {
    const wall = board.walls[w];
    if (!inPolygon(wall.x, wall.y, polygon)) return false;
  }
  return true;
}

function checkSplitSector(board: Board, sectorId: number, points: Collection<point2d>): [number, number, number] {
  const [fx, fy] = first(points);
  const [lx, ly] = last(points);
  const firstWall = wallInSector(board, sectorId, fx, fy);
  const lastWall = wallInSector(board, sectorId, lx, ly);
  if (firstWall == -1 || lastWall == -1)
    throw new Error(`Terminal points [${fx}, ${fy}], [${lx}, ${ly}] dont touch sector ${sectorId} walls`);
  const start = loopStart(board, firstWall);
  if (start != loopStart(board, lastWall))
    throw new Error(`Start ${firstWall} and end ${lastWall} walls in different loops`);
  return [firstWall, lastWall, start];
}

function splitSectorImpl(board: Board, sectorId: number, firstWall: number, lastWall: number, start: number, points: Collection<point2d>, refs: BuildReferenceTracker) {
  const wallMapper = (w: number) => board.walls[w];
  const sector = board.sectors[sectorId];
  const refWall = board.walls[firstWall];
  const lengthWoLast = points.length() - 1;
  const [newWalls, existedWalls, loopPoly] = getSplitLoop(board, firstWall, lastWall, points);
  const oldSectorBuilder = new SectorBuilder();
  const newSectorBuilder = new SectorBuilder()
    .addWalls(existedWalls)
    .addWalls(createNewWalls(newWalls, [], refWall, board))
    .loop();
  const firstLoopLength = newSectorBuilder.getWalls().length();

  for (const lid of loopPoints(board, sectorId)) {
    if (loopStart(board, lid) == start) continue;
    else (loopInPolygon(board, lid, loopPoly) ? newSectorBuilder : oldSectorBuilder).addLoop(map(loopWalls(board, lid), wallMapper));
  }
  const newSectorId = addSector(board, copySector(board.sectors[sectorId]));
  newSectorBuilder.build(board, newSectorId, refs);
  const newSector = board.sectors[newSectorId];
  const wallEnd = newSector.wallptr + firstLoopLength - 1;
  const mwalls = iter(range(wallEnd, wallEnd - lengthWoLast)).map(w => <point2d>[newSectorId, w]).collect();
  const reversedWoLast = iter(reversed(points)).take(lengthWoLast);
  oldSectorBuilder
    .addWalls(createNewWalls(reversedWoLast, mwalls, refWall, board))
    .addWalls(wallsBetween(board, firstWall, lastWall))
    .loop();
  const usedWalls = iter(sectorWalls(newSector)).map(wallMapper).collect();
  iter(sectorWalls(sector))
    .filter(w => usedWalls.includes(board.walls[w]))
    .forEach(w => board.walls[w] = null);
  oldSectorBuilder.build(board, sectorId, refs);
}

const POINT_MAPPER = (w: Wall) => <point2d>[w.x, w.y];
function getSplitLoop(board: Board, firstWall: number, lastWall: number, points: Iterable<point2d>): [Iterable<point2d>, Iterable<Wall>, Iterable<point2d>] {
  const newWalls = iter(points).butLast().collect();
  const existedWalls = [...wallsBetween(board, lastWall, firstWall)];
  const loopPoly = iter(map(existedWalls, POINT_MAPPER)).chain(newWalls).collect();
  return [newWalls, existedWalls, loopPoly];
}

function checkPointsOrder(board: Board, firstWall: number, lastWall: number, points: Collection<point2d>): boolean {
  const [, , loop] = getSplitLoop(board, firstWall, lastWall, points);
  return clockwise(loop);
}

export function splitSector(board: Board, sectorId: number, points: Collection<point2d>, refs: BuildReferenceTracker) {
  const [firstWall, lastWall, loop] = checkSplitSector(board, sectorId, points);
  if (checkPointsOrder(board, firstWall, lastWall, points)) {
    splitSectorImpl(board, sectorId, firstWall, lastWall, loop, points, refs);
  } else {
    splitSectorImpl(board, sectorId, lastWall, firstWall, loop, wrap([...reversed(points)]), refs);
  }
}