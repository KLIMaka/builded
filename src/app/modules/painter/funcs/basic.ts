import { handle, transformed, tuple, value } from "../../../../utils/callbacks";
import { clamp } from "../../../../utils/mathutils";
import { VecStack } from "../../../../utils/vecstack";
import { Context, Image } from "../api";
import { ImageBuilder, param, transformedParam, VOID_RENDERER } from "./common";

export function box(ctx: Context): Image {
  const builder = new ImageBuilder();
  const w = param('Width', 0.5);
  const h = param('Height', 0.5);
  const r = param('Radius', 0.1);
  const max = param('Max', 1);
  const profile = transformedParam('Profile', ctx.imageProvider(), ctx.oracle(builder.object()), ctx.currentImageName());

  const props = [w.prop, h.prop, r.prop, max.prop, profile.prop];

  const renderer = value(VOID_RENDERER);
  const settings = value(props);

  handle(null, (p, profile) => {
    if (profile == null) {
      renderer.set(VOID_RENDERER);
      settings.set(props);
      return
    }

    handle(p, (p, profile, w, h, r, max) => {
      renderer.set((stack: VecStack, pos: number) => {
        const dc = stack.apply(stack.sub(pos, stack.half), Math.abs);
        const d = stack.sub(dc, stack.push(w / 2, h / 2, 0, 0));
        const dist = Math.max(stack.x(d), stack.y(d));
        const cdist = clamp(dist, 0, r) / r;
        return stack.push(stack.x(stack.call(profile, stack.push(cdist, 0, 0, 0))) * max, 0, 0, 1);
      });
    }, profile.renderer, w.value, h.value, r.value, max.value);

    handle(p, (p, s) => {
      settings.set([...props, ...s]);
    }, profile.settings);

  }, profile.value);

  return builder
    .renderer(renderer)
    .settings(settings)
    .dependency(profile.value)
    .build();
}

export function circle(ctx: Context): Image {
  const radius = param('Radius', 0.5);
  const pow = param('Power', 0);

  const renderer = transformed(tuple(radius.value, pow.value), ([radius, pow]) => (stack: VecStack, pos: number) => {
    const l = stack.distance(stack.push(stack.x(pos), stack.y(pos), 0, 0), stack.push(0.5, 0.5, 0, 0));
    const v = clamp(radius - l, 0, radius);
    const p = 1 + pow;
    const pp = p >= 1 ? p : (1 / (2 - p))
    const k = Math.pow(v / radius, pp) * radius;
    return stack.push(k, 0, 0, 1);
  });
  return { renderer, settings: value([radius.prop, pow.prop]), dependsOn: _ => false }
}

export function pointDistance(ctx: Context): Image {
  return {
    renderer: value((stack: VecStack, pos: number) => stack.push(stack.distance(stack.push(0.5, 0.5, 0, 0), pos), 0, 0, 1)),
    settings: value([]),
    dependsOn: _ => false
  };
}