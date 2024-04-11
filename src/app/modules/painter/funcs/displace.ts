import { handle, value } from "../../../../utils/callbacks";
import { VecStack } from "../../../../utils/vecstack";
import { Context, Image, propSection } from "../api";
import { ImageBuilder, param, transformedParam, VOID_RENDERER } from "./common";

export function displace(ctx: Context): Image {
  const builder = new ImageBuilder();
  const oracle = ctx.images(builder.object());
  const src = transformedParam(ctx.ui(), 'Source', ctx.imageProvider(), oracle, ctx.currentImageName());
  const displace = transformedParam(ctx.ui(), 'Displace', ctx.imageProvider(), oracle);
  const scale = param(ctx.ui(), 'Scale', 1);
  const props = propSection('Displace', src.prop, displace.prop, scale.prop);

  const renderer = value(VOID_RENDERER);
  const settings = value(props);

  handle(null, (p, src, displace) => {
    if (src == null || displace == null) {
      renderer.set(VOID_RENDERER);
      settings.set(props);
      return
    }

    handle(p, (p, src, displace, scale) => {
      renderer.set((stack: VecStack, pos: number) => {
        return stack.call(src, stack.add(stack.scale(stack.call(displace, pos), scale), pos));
      });
    }, src.renderer, displace.renderer, scale.value);

    handle(p, (p, s, d) => {
      settings.set([...props, ...s, ...d]);
    }, src.settings, displace.settings);

  }, src.value, displace.value);


  return builder
    .renderer(renderer)
    .settings(settings)
    .dependency(src.value)
    .dependency(displace.value)
    .build();
}