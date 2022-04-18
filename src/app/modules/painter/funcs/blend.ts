import { handle, value } from "../../../../utils/callbacks";
import { VecStack } from "../../../../utils/vecstack";
import { Context, Image } from "../api";
import { ImageBuilder, param, transformedParam, VOID_RENDERER } from "./common";

const FUNCS = {
  "Blend": (stack: VecStack, lh: number, rh: number, t: number) => stack.lerp(lh, rh, t),
  "Max": (stack: VecStack, lh: number, rh: number, t: number) => stack.apply2(lh, rh, Math.max),
  "Min": (stack: VecStack, lh: number, rh: number, t: number) => stack.apply2(lh, rh, Math.min),
  "Add": (stack: VecStack, lh: number, rh: number, t: number) => stack.add(lh, rh),
  "Multiply": (stack: VecStack, lh: number, rh: number, t: number) => stack.mul(lh, rh),
}
const FUNCS_KEYS = Object.keys(FUNCS);

export function blend(ctx: Context): Image {
  const builder = new ImageBuilder();
  const oracle = ctx.oracle(builder.object());
  const src1 = transformedParam('Source 1', ctx.imageProvider(), oracle, ctx.currentImageName());
  const src2 = transformedParam('Source 2', ctx.imageProvider(), oracle);
  const func = transformedParam('Function', f => FUNCS[f], _ => FUNCS_KEYS, 'Blend');
  const t = param('Delta', 0.5);
  const props = [src1.prop, src2.prop, func.prop, t.prop];

  const renderer = value(VOID_RENDERER);
  const settings = value(props);

  handle(null, (p, src1, src2) => {
    if (src1 == null || src2 == null) {
      renderer.set(VOID_RENDERER);
      settings.set(props);
      return
    }

    handle(p, (p, src1, src2, func, t) => {
      renderer.set((stack: VecStack, pos: number) => {
        const s1 = stack.call(src1, pos);
        const s2 = stack.call(src2, pos);
        return func(stack, s1, s2, t);
      });
    }, src1.renderer, src2.renderer, func.value, t.value);

    handle(p, (p, s1, s2) => {
      settings.set([...props, ...s1, ...s2]);
    }, src1.settings, src2.settings);

  }, src1.value, src2.value);


  return builder
    .renderer(renderer)
    .settings(settings)
    .dependency(src1.value)
    .dependency(src2.value)
    .build();
}