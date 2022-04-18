import { handle, value } from "../../../../utils/callbacks";
import { VecStack } from "../../../../utils/vecstack";
import { Context, Image } from "../api";
import { ImageBuilder, param, transformedParam, VOID_RENDERER } from "./common";

export function transform(ctx: Context): Image {
  const builder = new ImageBuilder();
  const src = transformedParam('Source', ctx.imageProvider(), ctx.oracle(builder.object()), ctx.currentImageName());
  const scale = param('Scale', 1);
  const offx = param('X Offset', 0);
  const offy = param('Y Offset', 0);
  const props = [src.prop, scale.prop, offx.prop, offy.prop];

  const renderer = value(VOID_RENDERER);
  const settings = value(props);

  handle(null, (p, src) => {
    if (src == null) {
      renderer.set(VOID_RENDERER);
      settings.set(props);
      return
    }

    handle(p, (p, src, scale, offx, offy) => {
      renderer.set((stack: VecStack, pos: number) => {
        const half = stack.push(0.5, 0.5, 0, 0);
        const off = stack.push(offx, offy, 0, 0);
        const np = stack.add(stack.add(stack.scale(stack.sub(pos, half), scale < 0 ? scale : (1 / -scale)), half), off);
        return stack.call(src, np);
      });
    }, src.renderer, scale.value, offx.value, offy.value);

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