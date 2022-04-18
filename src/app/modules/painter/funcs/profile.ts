import { handle, value } from "../../../../utils/callbacks";
import { clamp, smothstep } from "../../../../utils/mathutils";
import { VecStack } from "../../../../utils/vecstack";
import { Context, Image } from "../api";
import { ImageBuilder, param, transformedParam, VOID_RENDERER } from "./common";

export function profile(ctx: Context): Image {
  const builder = new ImageBuilder();
  const src = transformedParam('Profile', ctx.imageProvider(), ctx.oracle(builder.object()), ctx.currentImageName());
  const y = param('Y', 0.5);

  const props = [src.prop, y.prop];

  const renderer = value(VOID_RENDERER);
  const settings = value(props);

  handle(null, (p, src) => {
    if (src == null) {
      renderer.set(VOID_RENDERER);
      settings.set(props);
      return
    }

    handle(p, (p, src, y) => {
      renderer.set((stack: VecStack, pos: number) => {
        const x = stack.x(pos);
        const p = stack.push(x, y, 0, 0);
        const value = stack.callScalar(src, p);
        const py = stack.y(pos);
        const mpy = 1 - py;
        const min = smothstep(value - mpy, 0, 0.01) * 100;
        const v = clamp(min, 0, 1);
        return stack.push(v, 0, 0, 1);
      });
    }, src.renderer, y.value);

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