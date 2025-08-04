import { Source, ValuesContainer } from "ts-utils/callbacks";
import { Controller3D } from "@utils/camera/controller3d";
import { len2d } from "ts-utils/mathutils";
import { EndMove, Move, StartMove } from "app/edit/messages";
import { Target } from "build/hitscan";
import { build2gl } from "build/utils";
import { vec3 } from "gl-matrix";
import { NOOP_RENDERABLE, Renderable } from "../api";
import { BoardRenderer3D } from "../boardRenderer3d";
import { EMPTY, Selection } from "../tools";

export function createTransform(values: ValuesContainer, ctl: Controller3D, move: Source<Boolean>, parallel: Source<boolean>, vertical: Source<boolean>, hitscan: Source<Target[]>, selection: Source<Selection>, renderer: Source<BoardRenderer3D>): Source<Renderable> {
  const object = values.value('transform-object', EMPTY);
  const moveStart = values.value('move-start', vec3.create());
  values.handleStandalone([move, ctl.camera.position, ctl.forwardMouse, parallel, vertical],
    ([move, campos, camdir, parallel, vert]) => {
      const obj = object.get();
      if (!move && obj === EMPTY) return;
      if (move && obj === EMPTY && selection.get() !== EMPTY) {
        object.set(selection.get());
        const origin = hitscan.get()[0].coords;
        object.get().handle(new StartMove(origin));
        moveStart.set(build2gl(vec3.create(), origin));
      } else if (move && obj !== EMPTY) {
        const origin = moveStart.get();
        if (vert) {
          const dx = origin[0] - campos[0];
          const dy = origin[2] - campos[2];
          const dz = campos[1] - origin[1];
          const t = len2d(dx, dy) / len2d(camdir[0], camdir[2]);
          obj.handle(new Move(0, 0, camdir[1] * t + dz));
        } else {
          const dz = origin[1] - campos[1];
          const t = dz / camdir[1];
          const result = vec3.copy(vec3.create(), camdir);
          vec3.scale(result, result, t);
          vec3.add(result, result, campos);
          const delta = vec3.sub(vec3.create(), result, origin);
          const dx = parallel && Math.abs(delta[0]) < Math.abs(delta[2]) ? 0 : delta[0];
          const dy = parallel && Math.abs(delta[2]) < Math.abs(delta[0]) ? 0 : delta[2];
          obj.handle(new Move(dx, dy, 0));
        }
      } else if (!move && obj !== EMPTY) {
        obj.handle(new EndMove());
        object.set(EMPTY);
      }
    });

  return values.transformedTuple('handle', [moveStart, object, renderer], ([start, obj, renderer]) => {
   /* if (obj === EMPTY) */return NOOP_RENDERABLE;
    // return renderer.writeGrid([{
    //   a: vec3.add(vec3.create(), start, vec3.fromValues(512 * 1024, 0, -512 * 1024)),
    //   b: vec3.add(vec3.create(), start, vec3.fromValues(-512 * 1024, 0, -512 * 1024)),
    //   c: vec3.add(vec3.create(), start, vec3.fromValues(-512 * 1024, 0, 512 * 1024)),
    //   d: vec3.add(vec3.create(), start, vec3.fromValues(512 * 1024, 0, 512 * 1024)),
    // }]);
  });
}