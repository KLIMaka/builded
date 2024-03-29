import { perlinOctaves } from "wasm_rust";
import { transformed, tuple, value } from "../../../../utils/callbacks";
import { octaves2d, perlin2d } from "../../../../utils/mathutils";
import { INT_MODEL, NumberModelBuilder } from "../../../../utils/ui/controls/numberbox";
import { VecStack } from "../../../../utils/vecstack";
import { Context, Image } from "../api";
import { param, paramModel } from "./common";

export function perlin(ctx: Context): Image {
  const scale = param('Scale', 256);
  const octaves = paramModel('Octaves', 1,
    new NumberModelBuilder(INT_MODEL).validation(x => x > 0 && x < 8).build());

  const renderer = transformed(tuple(scale.value, octaves.value), ([s, o]) => {
    return (stack: VecStack, pos: number) => {
      const x = stack.x(pos) * s;
      const y = stack.y(pos) * s;
      // const result = perlinOctaves(x, y, o);
      const result = octaves2d(perlin2d, o)(x, y);
      return stack.push(result, 0, 0, 1);
    }
  });

  return { renderer, settings: value([scale.prop, octaves.prop]), dependsOn: _ => false }
}
