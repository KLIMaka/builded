import { transformed, tuple, value } from "../../../../utils/callbacks";
import { VecStack } from "../../../../utils/vecstack";
import { pointGrid } from "../sdf/sdf";
import { Context, Image } from "../api";
import { param } from "./common";

export function grid(ctx: Context): Image {
  const offx = param('X Offset', 0)
  const offy = param('Y Offset', 0);
  const scale = param('Scale', 1);

  const off = ctx.stack().pushGlobal(0, 0, 0, 0);
  const s = ctx.stack().pushGlobal(1, 1, 1, 1);

  const props = [offx.prop, offy.prop, scale.prop];

  const renderer = transformed(tuple(offx.value, offy.value, scale.value), ([offx, offy, scale]) => {
    ctx.stack().set(off, offx, offy, 0, 0);
    ctx.stack().spread(s, scale);
    const f = pointGrid(s, off);
    return (stack: VecStack, pos: number) => stack.call(f, pos);
  });

  return { renderer, settings: value(props), dependsOn: _ => false };
}
