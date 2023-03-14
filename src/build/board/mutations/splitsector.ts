import { ArtInfoProvider } from 'build/formats/art';
import { vec3 } from 'gl-matrix';
import { cross2d, dot2d, int, len2d } from '../../../utils/mathutils';
import { BuildReferenceTracker } from '../../../app/apis/app';
import { track } from '../../../app/apis/referencetracker';
import { all, Collection, enumerate, first, last, map, range, reversed, takeFirst, wrap } from '../../../utils/collections';
import { iter } from '../../../utils/iter';
import { clockwise, inPolygon, rayIntersect, wallNormal } from '../../utils';
import { loopPoints, loopStart, loopWalls, sectorWalls, wallsBetween } from '../loops';
import { sectorOfWall, wallInSector } from '../query';
import { Board, Wall } from '../structs';
import { BoardWall, EngineApi, WallCloner } from './api';
import { addSector } from './internal';
import { SectorBuilder } from './sectorbuilder';
import { fixxrepeat, splitWall } from './walls';

type point2d = [number, number];

function* createNewWalls<B extends Board>(points: Iterable<[number, number]>, matchWalls: [number, number][], commonWall: BoardWall<B>, board: B, cloneWall: WallCloner<BoardWall<B>>): Generator<Wall> {
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
      wall.xrepeat = 0;
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

function splitSectorImpl<B extends Board>(board: B, sectorId: number, firstWall: number, lastWall: number, start: number, points: Collection<point2d>, refs: BuildReferenceTracker, api: EngineApi<B>) {
  const WALL_MAPPER = (w: number) => board.walls[w];
  const refWall = board.walls[firstWall];
  const lengthWoLast = points.length() - 1;
  const [newWalls, existedWalls, loopPoly] = getSplitLoop(board, firstWall, lastWall, points, api.cloneWall);
  const oldSectorBuilder = new SectorBuilder();
  const newSectorBuilder = new SectorBuilder()
    .addWalls(existedWalls)
    .addWalls(createNewWalls(newWalls, [], refWall, board, api.cloneWall))
    .loop();
  const firstLoopLength = newSectorBuilder.wallsLength();

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
  oldSectorBuilder.build(board, sectorId, refs);
  return newSectorId;
}

const POINT_MAPPER = (w: Wall) => <point2d>[w.x, w.y];
function getSplitLoop<B extends Board>(board: B, firstWall: number, lastWall: number, points: Iterable<point2d>, cloneWall: WallCloner<BoardWall<B>>): [Iterable<point2d>, Iterable<Wall>, Iterable<point2d>] {
  const newWalls = iter(points).butLast().collect();
  const existedWalls = [...iter(wallsBetween(board, lastWall, firstWall)).map(w => cloneWall(board.walls[w]))];
  const loopPoly = iter(map(existedWalls, POINT_MAPPER)).chain(newWalls).collect();
  return [newWalls, existedWalls, loopPoly];
}

function checkPointsOrder<B extends Board>(board: B, firstWall: number, lastWall: number, points: Collection<point2d>, cloneWall: WallCloner<BoardWall<B>>): boolean {
  const [, , loop] = getSplitLoop(board, firstWall, lastWall, points, cloneWall);
  return clockwise(loop);
}

export function splitSector<B extends Board>(board: B, sectorId: number, points: Collection<point2d>, refs: BuildReferenceTracker, api: EngineApi<B>) {
  const [firstWall, lastWall, loop] = checkSplitSector(board, sectorId, points);
  if (checkPointsOrder(board, firstWall, lastWall, points, api.cloneWall))
    return splitSectorImpl(board, sectorId, firstWall, lastWall, loop, points, refs, api);
  else
    return splitSectorImpl(board, sectorId, lastWall, firstWall, loop, wrap([...reversed(points)]), refs, api);
}

export function splitSectorFromPoint<B extends Board>(board: B, wallId: number, pointonWall: point2d, art: ArtInfoProvider, refs: BuildReferenceTracker, api: EngineApi<B>) {
  const wall = board.walls[wallId];
  const wall2 = board.walls[wall.point2];
  const px = int(pointonWall[0]);
  const py = int(pointonWall[1]);
  const [nx, , ny] = wallNormal(vec3.create(), board, wallId);
  const sectorId = sectorOfWall(board, wallId);
  const inters: { x: number, y: number, t: number, w: number }[] = [];
  for (const w of sectorWalls(board, sectorId)) {
    if (w == wallId) continue;
    const wall = board.walls[w];
    const wall2 = board.walls[wall.point2];
    const dx = wall.x - px;
    const dy = wall.y - py;
    if (cross2d(nx, ny, dx, dy) == 0 && dot2d(nx, ny, dx, dy) > 0) {
      inters.push({ x: wall.x, y: wall.y, w, t: len2d(dx, dy) });
    } else {
      const inter = rayIntersect(px, py, 0, nx, ny, 0, wall.x, wall.y, wall2.x, wall2.y);
      if (inter != null) {
        const [x, y, , t] = inter;
        inters.push({ x: int(x), y: int(y), t, w });
      }
    }
  }
  inters.sort((l, r) => l.t - r.t);
  const closest = takeFirst(inters);
  if (closest == null) return false;
  if (loopStart(board, closest.w) != loopStart(board, wallId)) return false;
  track(refs.walls, refwalls => {
    const closestWallRef = refwalls.ref(closest.w);
    const onWallPoint = px == wall.x && py == wall.y || px == wall2.x && py == wall2.y;
    if (!onWallPoint) splitWall(board, wallId, px, py, art, refs, api.cloneWall);
    const endWall = wallInSector(board, sectorId, closest.x, closest.y);
    if (endWall == -1) splitWall(board, refwalls.val(closestWallRef), closest.x, closest.y, art, refs, api.cloneWall);
  })
  splitSector(board, sectorId, wrap([[px, py], [closest.x, closest.y]]), refs, api);
  return true;
}