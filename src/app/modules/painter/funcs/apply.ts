import { handle, value } from "../../../../utils/callbacks";
import { clamp, fract, smothstep } from "../../../../utils/mathutils";
import { VecStack } from "../../../../utils/vecstack";
import { Context, Image, propSection } from "../api";
import { ImageBuilder, param, transformedParam, VOID_RENDERER } from "./common";

const FUNCS = new Map<string, (x: number) => number>();
FUNCS.set("Fract", fract);
FUNCS.set("Sin", Math.sin);
FUNCS.set("Ident", x => x);
FUNCS.set("Sin1", x => (1 - smothstep(x, 0, Math.PI * 2)) * Math.sin(x));
FUNCS.set("Clamp", x => clamp(x, 0, 1));
FUNCS.set("Max 0.5", x => Math.max(x, 0.5));

export function apply(ctx: Context): Image {
  const builder = new ImageBuilder();
  const src = transformedParam(ctx.ui(), 'Source', ctx.imageProvider(), ctx.images(builder.object()), ctx.currentImageName());
  const func = transformedParam(ctx.ui(), 'Function', f => FUNCS.get(f), () => FUNCS.keys(), 'Ident');
  const scale = param(ctx.ui(), 'Scale', 1);
  const offset = param(ctx.ui(), 'Offset', 0);

  const off = ctx.stack().pushGlobal(0, 0, 0, 0);
  const s = ctx.stack().pushGlobal(1, 1, 1, 1);

  const props = propSection('Apply', src.prop, func.prop, scale.prop, offset.prop);

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