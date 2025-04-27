import { arrayEq, Source, ValuesContainer } from "@utils/callbacks";
import { Controller3D } from "@utils/camera/controller3d";
import { iter } from "@utils/iter";
import { len2d } from "@utils/mathutils";
import { identity } from "@utils/types";
import { ArtInfoExtended, BoardContext } from "app/apis/engine";
import { Message, MessageHandler } from "app/apis/handler";
import { EndMove, Move, StartMove } from "app/edit/messages";
import { SectorEnt } from "app/edit/sector";
import { WallSegmentsEnt } from "app/edit/wallsegment";
import { EMPTY_ENTITY, Entity, entityEq, Hitscan, hitscan, Ray, Target } from "build/hitscan";
import { build2gl, gl2build } from "build/utils";
import { vec3 } from "gl-matrix";
import { ViewPosition } from "./view";
import { WallEnt } from "app/edit/wall";

export type Selection = {

} & MessageHandler;

const EMPTY: Selection = {
  handle: function (message: Message): void { }
}

export function createSelection(values: ValuesContainer, hitscan: Source<Entity>, boardCtx: BoardContext): Source<Selection> {
  return values.transformed('selection', hitscan, hit => {
    if (hit.isWall()) {
      return new WallEnt(hit.id, boardCtx);
      // const board = boardCtx.board.get();
      // const w1 = board.walls[hit.id].point2;
      // return new WallSegmentsEnt([hit, Entity.wallPoint(w1)], boardCtx);
    } else if (hit.isSector()) {
      return new SectorEnt(hit, boardCtx);
    }
    return EMPTY;
  });
}

export function createTransform(values: ValuesContainer, ctl: Controller3D, move: Source<Boolean>, parallel: Source<boolean>, vertical: Source<boolean>, hitscan: Source<Target[]>, selection: Source<Selection>) {
  let object = EMPTY;
  let moveStart = vec3.create();
  values.handleStandalone([move, ctl.camera.position, ctl.forwardMouse, parallel, vertical],
    ([move, campos, camdir, parallel, vert]) => {
      if (!move && object === EMPTY) return;
      if (move && object === EMPTY && selection.get() !== EMPTY) {
        object = selection.get();
        const origin = hitscan.get()[0].coords;
        object.handle(new StartMove(origin));
        moveStart = build2gl(vec3.create(), origin);
      } else if (move && object !== EMPTY) {
        const origin = moveStart;
        if (vert) {
          const dx = origin[0] - campos[0];
          const dy = origin[2] - campos[2];
          const dz = campos[1] - origin[1];
          const t = len2d(dx, dy) / len2d(camdir[0], camdir[2]);
          object.handle(new Move(0, 0, camdir[1] * t + dz));
        } else {
          const dz = origin[1] - campos[1];
          const t = dz / camdir[1];
          const result = vec3.copy(vec3.create(), camdir);
          vec3.scale(result, result, t);
          vec3.add(result, result, campos);
          const delta = vec3.sub(vec3.create(), result, origin);
          const dx = parallel && Math.abs(delta[0]) < Math.abs(delta[2]) ? 0 : delta[0];
          const dy = parallel && Math.abs(delta[2]) < Math.abs(delta[0]) ? 0 : delta[2];
          object.handle(new Move(dx, dy, 0));
        }
      } else if (!move && object !== EMPTY) {
        object.handle(new EndMove());
        object = EMPTY;
      }
    });
}

export function createHitscan(values: ValuesContainer, ctl: Controller3D, viewPosition: Source<ViewPosition>, art: Source<Map<number, ArtInfoExtended>>, boardCtx: BoardContext): Source<Target[]> {
  const hit = new Hitscan();
  const ray = values.transformedTuple('ray', [ctl.forwardMouse, viewPosition], ([fwd, pos]) => new Ray(vec3.fromValues(pos.x, pos.y, pos.z), gl2build(vec3.create(), fwd)));
  const targetEq = (l: Target, r: Target) => entityEq(l.entity, r.entity) && vec3.exactEquals(l.coords, r.coords);
  return values.transformedTuple('hitscan', [ray, viewPosition, art, boardCtx.board], ([{ start, dir }, pos, art, board]) => {
    if (pos.sec === -1) return [];
    const fwd = gl2build(vec3.create(), ctl.getForward());
    hit.reset(start[0], start[1], start[2], dir[0], dir[1], dir[2], fwd[0], fwd[1], fwd[2]);
    hitscan(board, boardCtx.spritesBySector, art, pos.sec, hit, 0);
    return [...hit.targets()];
  }, { eq: (l, r) => arrayEq(l, r, targetEq) });
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

export type DrawSectorTool = {
  start(): void;
}

type SectorContour = {
  z: number,
  points: number[],
}

export function createDrawSectorTool(values: ValuesContainer, ctl: Controller3D): DrawSectorTool {
  const active = values.value('drawsector-active', false);
  let state = {};
  values.handleStandalone([active, ctl.camera.position, ctl.forwardMouse], ([active, campos, camdir]) => {
    if (!active) return;

  });
}