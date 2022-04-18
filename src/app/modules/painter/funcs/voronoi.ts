import { handle, value } from "../../../../utils/callbacks";
import { map } from "../../../../utils/collections";
import { fract, Vec2Hash } from "../../../../utils/mathutils";
import { VecStack } from "../../../../utils/vecstack";
import { Context, Image } from "../api";
import { ImageBuilder, param, transformedParam, VOID_RENDERER } from "./common";

const CORE: [number, number][] = [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]

export function voronoi(ctx: Context): Image {
  const builder = new ImageBuilder();
  const src = transformedParam('Source', ctx.imageProvider(), ctx.oracle(builder.object()), ctx.currentImageName());
  const scale = param('Scale', 4);
  const props = [src.prop, scale.prop];

  const core = [...map(CORE, c => ctx.stack().pushGlobal(c[0], c[1], 0, 0))];

  const renderer = value(VOID_RENDERER);
  const settings = value(props);

  handle(null, (p, src) => {
    if (src == null) {
      renderer.set(VOID_RENDERER);
      settings.set(props);
      return
    }

    handle(p, (p, src, scale) => {
      const cache = new Map<number, [number, number]>();
      const sample = (stack: VecStack, pos: number) => {
        const hash = Vec2Hash([stack.x(pos), stack.y(pos)]);
        const result = cache.get(hash);
        if (result == undefined) {
          const v = stack.call(src, pos);
          cache.set(hash, [stack.x(v), stack.y(v)]);
          return v;
        }
        return stack.push(result[0], result[1], 0, 0);
      }

      renderer.set((stack: VecStack, pos: number) => {
        const s1 = 1 / scale;
        const n = stack.scale(pos, scale);
        const c = stack.apply(n, Math.floor);
        const f = stack.apply(n, fract);

        let mind = 8;
        let mini = 0;
        const minr = stack.allocate();

        for (let i = 0; i < 9; i++) {
          stack.begin();
          const xy = core[i];
          const v = stack.call(sample, stack.scale(stack.add(c, xy), s1));
          const r = stack.add(xy, stack.sub(v, f));
          const d = stack.sqrlength(r);
          if (d < mind) {
            mind = d;
            mini = i;
            stack.copy(minr, r);
          }
          stack.end();
        }

        const minxy = core[mini];
        mind = 8;
        for (let i = 0; i < 9; i++) {
          stack.begin();
          const xy = stack.add(minxy, core[i]);
          const v = stack.call(sample, stack.scale(stack.add(c, xy), s1));
          const r = stack.add(xy, stack.sub(v, f));
          const dr = stack.sub(r, minr);
          if (stack.eqz(dr)) { stack.end(); continue }
          const sr = stack.scale(stack.add(r, minr), 0.5);
          const d = Math.abs(stack.dot(sr, dr));
          mind = Math.min(d, mind);
          stack.end();
        }

        return stack.push(mind, 0, 0, 0);
      });
    }, src.renderer, scale.value);

    handle(p, (p, s) => {
      settings.set([...props, ...s]);
    }, src.settings);

  }, src.value);

  return builder
    .renderer(renderer)
    .settings(settings)
    .dependency(src.value)
    .build();
}