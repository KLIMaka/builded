import { handle, value } from "../../../../utils/callbacks";
import { clamp, fract, smothstep } from "../../../../utils/mathutils";
import { VecStack } from "../../../../utils/vecstack";
import { Context, Image } from "../api";
import { ImageBuilder, param, transformedParam, VOID_RENDERER } from "./common";

const FUNCS = {
  "Fract": fract,
  "Sin": Math.sin,
  "Ident": (x: number) => x,
  "Sin1": (x: number) => (1 - smothstep(x, 0, Math.PI * 2)) * Math.sin(x),
  "Clamp": (x: number) => clamp(x, 0, 1),
  "Max 0.5": (x: number) => Math.max(x, 0.5)
}
const FUNCS_KEYS = Object.keys(FUNCS);

export function apply(ctx: Context): Image {
  const builder = new ImageBuilder();
  const src = transformedParam('Source', ctx.imageProvider(), ctx.oracle(builder.object()), ctx.currentImageName());
  const func = transformedParam('Function', f => FUNCS[f], _ => FUNCS_KEYS, 'Ident');
  const scale = param('Scale', 1);
  const offset = param('Offset', 0);

  const off = ctx.stack().pushGlobal(0, 0, 0, 0);
  const s = ctx.stack().pushGlobal(1, 1, 1, 1);

  const props = [src.prop, func.prop, scale.prop, offset.prop];

  const renderer = value(VOID_RENDERER);
  const settings = value(props);

  handle(null, (p, src) => {
    if (src == null) {
      renderer.set(VOID_RENDERER);
      settings.set(props);
      return
    }

    handle(p, (p, src, func, scale, offset) => {
      ctx.stack().spread(off, offset);
      ctx.stack().spread(s, scale);
      renderer.set((stack: VecStack, pos: number) => {
        return stack.apply(stack.add(stack.mul(stack.call(src, pos), s), off), func);
      });
    }, src.renderer, func.value, scale.value, offset.value);

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