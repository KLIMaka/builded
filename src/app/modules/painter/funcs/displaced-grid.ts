import { handle, value } from "../../../../utils/callbacks";
import { VecStack } from "../../../../utils/vecstack";
import { displacedPointGrid } from "../sdf/sdf";
import { Context, Image } from "../api";
import { ImageBuilder, param, transformedParam, VOID_RENDERER } from "./common";

export function displacedGrid(ctx: Context): Image {
  const builder = new ImageBuilder();
  const src = transformedParam('Source', ctx.imageProvider(), ctx.oracle(builder.object()), ctx.currentImageName());
  const scale = param('Scale', 1);
  const props = [src.prop, scale.prop];

  const s = ctx.stack().pushGlobal(1, 1, 1, 1);

  const renderer = value(VOID_RENDERER);
  const settings = value(props);

  handle(null, (p, src) => {
    if (src == null) {
      renderer.set(VOID_RENDERER);
      settings.set(props);
      return
    }

    handle(p, (p, src, scale) => {
      ctx.stack().spread(s, scale);
      renderer.set((stack: VecStack, pos: number) => {
        return stack.call(displacedPointGrid(s, stack.zero, src), stack.push(stack.x(pos), stack.y(pos), 0, 0));
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