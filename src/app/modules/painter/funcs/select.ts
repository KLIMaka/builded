import { handle, value } from "../../../../utils/callbacks";
import { smothstep } from "../../../../utils/mathutils";
import { VecStack } from "../../../../utils/vecstack";
import { Context, Image } from "../api";
import { ImageBuilder, param, transformedParam, VOID_RENDERER } from "./common";

export function select(ctx: Context): Image {
  const builder = new ImageBuilder();
  const src = transformedParam('Source', ctx.imageProvider(), ctx.oracle(builder.object()), ctx.currentImageName());
  const from = param('From', 0);
  const to = param('To', 0);
  const smoth = param('Smoth', 0);

  const props = [src.prop, from.prop, to.prop, smoth.prop];

  const renderer = value(VOID_RENDERER);
  const settings = value(props);

  handle(null, (p, src) => {
    if (src == null) {
      renderer.set(VOID_RENDERER);
      settings.set(props);
      return
    }

    handle(p, (p, src, from, to, smoth) => {
      renderer.set((stack: VecStack, pos: number) => {
        const value = stack.callScalar(src, pos);
        const l = smothstep(value, from - smoth, from);
        const r = 1 - smothstep(value, to, to + smoth);
        return stack.push(Math.min(l, r), 0, 0, 1);
      });
    }, src.renderer, from.value, to.value, smoth.value);

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
