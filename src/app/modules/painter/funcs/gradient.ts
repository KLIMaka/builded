import { handle, value } from "../../../../utils/callbacks";
import { VecStack } from "../../../../utils/vecstack";
import { Context, Image } from "../api";
import { ImageBuilder, param, transformedParam, VOID_RENDERER } from "./common";

function grad(f: (stack: VecStack, pos: number) => number, stack: VecStack, pos: number, d: number) {
  const dx = stack.push(d, 0, 0, 0);
  const dy = stack.push(0, d, 0, 0);
  const d1 = stack.x(f(stack, stack.add(pos, dx)));
  const d2 = stack.x(f(stack, stack.sub(pos, dx)));
  const d3 = stack.x(f(stack, stack.add(pos, dy)));
  const d4 = stack.x(f(stack, stack.sub(pos, dy)));
  return stack.normalize(stack.push(d1 - d2, d3 - d4, d, 0));
}

export function gradient(ctx: Context): Image {
  const builder = new ImageBuilder();
  const src = transformedParam('Source', ctx.imageProvider(), ctx.oracle(builder.object()), ctx.currentImageName());
  const scale = param('Scale', 1);
  const sample = param('Samle Scale', 0.001);
  const props = [src.prop, scale.prop, sample.prop];

  const renderer = value(VOID_RENDERER);
  const settings = value(props);

  handle(null, (p, src) => {
    if (src == null) {
      renderer.set(VOID_RENDERER);
      settings.set(props);
      return
    }

    handle(p, (p, src, scale, sample) => {
      renderer.set((stack: VecStack, pos: number) => {
        return stack.scale(grad(src, stack, pos, sample), scale);
      });
    }, src.renderer, scale.value, sample.value);

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