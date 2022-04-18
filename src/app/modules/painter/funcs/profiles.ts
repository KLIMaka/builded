import { transformed, tuple, value } from "../../../../utils/callbacks";
import { VecStack } from "../../../../utils/vecstack";
import { Context, Image } from "../api";
import { param, transformedParam } from "./common";

const PROFILES = {
  'Identity': (x: number) => x,
  'Sin': (x: number) => Math.sin(x),
  'Cos': (x: number) => Math.cos(x),
  'Step': (x: number) => x <= 0 ? 1 : x <= 0.5 ? 0.5 : 0,
  'Circle': (x: number) => Math.abs(x) > 1 ? 0 : Math.sqrt(1 - x * x),
  'Anti Circle': (x: number) => Math.abs(x) > 1 ? 0 : 1 - Math.sqrt(1 - x * x),
}
const PROFILE_KEYS = Object.keys(PROFILES);

export function profiles(ctx: Context): Image {
  const profile = transformedParam('Profile', s => PROFILES[s], _ => PROFILE_KEYS, 'Identity');
  const xoff = param('X Offset', 0);
  const yoff = param('Y Offset', 0);
  const xscale = param('X Scale', 1);
  const yscale = param('Y Scale', 1);

  const renderer = transformed(tuple(profile.value, xoff.value, yoff.value, xscale.value, yscale.value), ([profile, xoff, yoff, xscale, yscale]) => (stack: VecStack, pos: number) => {
    const x = stack.x(stack.add(stack.scale(pos, xscale), stack.push(xoff, 0, 0, 0)));
    return stack.push(yoff + profile(x) * yscale, 0, 0, 1);
  });

  return { renderer, settings: value([profile.prop, xoff.prop, yoff.prop, xscale.prop, yscale.prop]), dependsOn: _ => false };
}