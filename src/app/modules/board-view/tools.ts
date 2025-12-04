import { arrayEq, Source, ValuesContainer } from "ts-utils/callbacks";
import { Controller3D } from "@utils/camera/controller3d";
import { iter } from "ts-utils/iter";
import { identity, pair } from "ts-utils/types";
import { ArtInfoExtended, BoardContext, EngineContext, gridSnap } from "app/apis/engine";
import { Message, MessageHandler } from "app/apis/handler";
import { SectorEnt } from "app/edit/sector";
import { WallEnt } from "app/edit/wall";
import { closestWallInSectorDist, closestWallSegmentInSectorDist } from "build/board/distances";
import { sectorOfWall, snapWall } from "build/board/query";
import { EMPTY_ENTITY, EMPTY_TARGET, Entity, entityEq, EntityType, Hitscan, hitscan, Ray, Target, targetEq } from "build/hitscan";
import { gl2build, slope } from "build/utils";
import { vec3 } from "gl-matrix";
import { ViewPosition } from "./view";
import { WallSegmentsEnt } from "app/edit/wallsegment";
import { SpriteEnt } from "app/edit/sprite";

export type Selection = {

} & MessageHandler;

export const EMPTY: Selection = {
  handle: function (message: Message): void { }
}

export function createSelection(values: ValuesContainer, hitscan: Source<Entity>, boardCtx: BoardContext, engine: EngineContext): Source<Selection> {
  return values.transformed('selection', hitscan, hit => {
    if (hit.isWall()) {
      return new WallEnt(hit, boardCtx, engine);
      // const board = boardCtx.board.get();
      // const w1 = board.walls[hit.id].point2;
      // return new WallSegmentsEnt([hit, Entity.wallPoint(w1)], boardCtx);
    } else if (hit.isSector()) {
      return new SectorEnt(hit, boardCtx, engine);
    } else if (hit.isSprite()) {
      return new SpriteEnt(hit.id, boardCtx, engine);
    }
    return EMPTY;
  });
}

export function createHitscan(values: ValuesContainer, ctl: Controller3D, viewPosition: Source<ViewPosition>, art: Source<Map<number, ArtInfoExtended>>, boardCtx: BoardContext): Source<Target[]> {
  const hit = new Hitscan();
  const ray = values.transformedTuple('ray', [ctl.forwardMouse, viewPosition], ([fwd, pos]) => new Ray(vec3.fromValues(pos.x, pos.y, pos.z), gl2build(vec3.create(), fwd)));
  return values.transformedTuple('hitscan', [ray, viewPosition, art, boardCtx.data], ([{ start, dir }, pos, art, data]) => {
    if (pos.sec === -1) return [];
    const fwd = gl2build(vec3.create(), ctl.getForward());
    hit.reset(start[0], start[1], start[2], dir[0], dir[1], dir[2], fwd[0], fwd[1], fwd[2]);
    hitscan(data, art, pos.sec, hit, 0);
    return [...hit.targets()];
  }, { eq: (l, r) => arrayEq(l, r, targetEq) });
}

export function createSnapTarget(values: ValuesContainer, hitscan: Source<Target[]>, boardCtx: BoardContext): Source<Target> {
  return values.transformedTuple('snap-target', [hitscan, boardCtx.data, boardCtx.grid.size], ([hit, data, gridSize]) => {
    if (hit.length === 0) return EMPTY_TARGET;
    const target = hit[0];
    // const { entity: ent, coords: [x, y, z] } = target;
    // if (ent.type === EntityType.NONE) return target;
    // const gridScale = boardCtx.grid.size.get();
    // if (ent.isSector()) {
    //   // const sectorId = ent.id;
    //   // const [wallPoint, wallPointDist] = closestWallInSectorDist(board, sectorId, x, y);
    //   // const [wallSegment, wallSegmentDist] = closestWallSegmentInSectorDist(board, sectorId, x, y);
    //   return { coords: [gridSnap(gridSize, x), gridSnap(gridSize, y), z], entity: ent };

    //   // if (wallPointDist < wallSegmentDist) {
    //   //   if (wallPointDist > 64) return { coords: [gridSnap(gridSize, x), gridSnap(gridSize, y), z], entity: ent };
    //   //   const wall = board.walls[wallPoint];
    //   //   return { coords: [wall.x, wall.y, z], entity: Entity.of(wallPoint, EntityType.WALL_POINT) }
    //   // } else {
    //   //   if (wallSegmentDist > 64) return { coords: [gridSnap(gridSize, x), gridSnap(gridSize, y), z], entity: ent };
    //   //   const wall = board.walls[wallSegment];
    //   //   const type = ent.type === EntityType.CEILING ? EntityType.WALL_CEILING : EntityType.WALL_FLOOR;
    //   //   return { coords: [wall.x, wall.y, z], entity: Entity.of(wallSegment, type) }
    //   // }
    // } else if (ent.isWall()) {
    //   const wallId = ent.id;
    //   const wall1 = board.walls[wallId];
    //   const wall2 = board.walls[wall1.point2];
    //   const [sx, sy] = snapWall(board, wallId, x, y, x => gridSnap(gridSize, x));
    //   if (sx === wall1.x && sy === wall1.y) return { coords: [sx, sy, z], entity: Entity.of(wallId, EntityType.WALL_POINT) };
    //   if (sx === wall2.x && sy === wall2.y) return { coords: [sx, sy, z], entity: Entity.of(wall1.point2, EntityType.WALL_POINT) };
    //   const edges: [Target, number][] = [];
    //   const sectorId = sectorOfWall(board, wallId);
    //   const cz = slope(board, sectorId, sx, sy, true);
    //   const fz = slope(board, sectorId, sx, sy, false);
    //   edges.push(pair({ coords: [sx, sy, cz], entity: Entity.of(wallId, EntityType.WALL_CEILING) }, Math.abs(cz - z)));
    //   edges.push(pair({ coords: [sx, sy, fz], entity: Entity.of(wallId, EntityType.WALL_FLOOR) }, Math.abs(fz - z)));
    //   if (wall1.nextsector !== -1) {
    //     const nextSectorId = wall1.nextsector;
    //     const ncz = slope(board, nextSectorId, sx, sy, true);
    //     const nfz = slope(board, nextSectorId, sx, sy, false);
    //     edges.push(pair({ coords: [sx, sy, ncz], entity: Entity.of(wallId, EntityType.WALL_NEXT_UPPER) }, Math.abs(ncz - z)));
    //     edges.push(pair({ coords: [sx, sy, nfz], entity: Entity.of(wallId, EntityType.WALL_NEXT_LOWER) }, Math.abs(nfz - z)));
    //   }
    //   edges.sort(([_1, ld], [_2, rd]) => ld - rd);
    //   const [edge, dist] = edges[0];
    //   if (dist < gridScale) return edge;
    // }
    return target;

  }, { eq: targetEq });
}

export function createTargets(values: ValuesContainer, hitscan: Source<Target[]>): Source<Target[]> {
  const targetEq = (l: Target, r: Target) => entityEq(l.entity, r.entity);
  return values.transformed('targets', hitscan, identity(), { eq: (l, r) => arrayEq(l, r, targetEq) });
}

export function createEntity(values: ValuesContainer, targets: Source<Target[]>): Source<Entity> {
  const ent = values.transformed('entity', targets, targets => {
    const target = iter(targets).first(t => t.entity !== null && (t.entity.isSector() || t.entity.isWall() || t.entity.isSprite()));
    return target.map(t => t.entity).orElse(EMPTY_ENTITY);
    // return iter(targets).first(t => t.entity !== null).map(t => t.entity).orElse(null);
  }, { eq: entityEq });
  return ent;
}