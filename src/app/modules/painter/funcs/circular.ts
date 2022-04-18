import { handle, value } from "../../../../utils/callbacks";
import { VecStack } from "../../../../utils/vecstack";
import { circularArray } from "../sdf/sdf";
import { Context, Image } from "../api";
import { ImageBuilder, param, transformedParam, VOID_RENDERER } from "./common";

export function circular(ctx: Context): Image {
  const builder = new ImageBuilder();
  const src = transformedParam('Source', ctx.imageProvider(), ctx.oracle(builder.object()), ctx.currentImageName());
  const count = param('Count', 1);

  const props = [src.prop, count.prop];

  const renderer = value(VOID_RENDERER);
  const settings = value(props);

  handle(null, (p, src) => {
    if (src == null) {
      renderer.set(VOID_RENDERER);
      settings.set(props);
      return
    }

    handle(p, (p, src, count) => {
      renderer.set((stack: VecStack, pos: number) => {
        return stack.call(circularArray(count, src), pos);
      });
    }, src.renderer, count.value);

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