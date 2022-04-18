import { handle, value } from "../../../../utils/callbacks";
import { fract } from "../../../../utils/mathutils";
import { VecStack } from "../../../../utils/vecstack";
import { Context, Image } from "../api";
import { ImageBuilder, param, transformedParam, VOID_RENDERER } from "./common";

export function repeat(ctx: Context): Image {
  const builder = new ImageBuilder();
  const src = transformedParam('Source', ctx.imageProvider(), ctx.oracle(builder.object()), ctx.currentImageName());
  const scalex = param('Scale X', 3);
  const scaley = param('Scale Y', 3);
  const props = [src.prop, scalex.prop, scaley.prop];

  const renderer = value(VOID_RENDERER);
  const settings = value(props);

  handle(null, (p, src) => {
    if (src == null) {
      renderer.set(VOID_RENDERER);
      settings.set(props);
      return
    }

    handle(p, (p, src, scalex, scaley) => {
      renderer.set((stack: VecStack, pos: number) => {
        const s = stack.push(scalex, scaley, 0, 0);
        return stack.call(src, stack.apply(stack.mul(pos, s), fract));
      });
    }, src.renderer, scalex.value, scaley.value);

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