import { handle, value } from "../../../../utils/callbacks";
import { clamp } from "../../../../utils/mathutils";
import { VecStack } from "../../../../utils/vecstack";
import { ambientOcclusion, sdf3d, softShadow } from "../sdf/sdf";
import { Context, Image } from "../api";
import { ImageBuilder, param, transformedParam, VOID_RENDERER } from "./common";

export function render(ctx: Context): Image {
  const builder = new ImageBuilder();
  const hmap = transformedParam('Height Map', ctx.imageProvider(), ctx.oracle(builder.object()), ctx.currentImageName());
  const lightX = param('Light X', 0.7);
  const lightY = param('Light Y', 0);
  const lightZ = param('Light Z', -0.5);
  const props = [hmap.prop, lightX.prop, lightY.prop, lightZ.prop];

  const toLight = ctx.stack().pushGlobal(0, 0, 0, 0);

  const renderer = value(VOID_RENDERER);
  const settings = value(props);

  handle(null, (p, hmap) => {
    if (hmap == null) {
      renderer.set(VOID_RENDERER);
      settings.set(props);
      return
    }

    handle(p, (p, hmap, lightX, lightY, lightZ) => {
      ctx.stack().begin();
      ctx.stack().copy(toLight,
        ctx.stack().normalize(
          ctx.stack().sub(
            ctx.stack().push(lightX, lightY, lightZ, 0),
            ctx.stack().push(0.5, 0.5, 0, 0)
          )));
      ctx.stack().end();
      const shape = (stack: VecStack, pos: number) => {
        const x = stack.x(pos);
        const y = stack.y(pos);
        const z = stack.z(pos);
        const v = stack.x(stack.call(hmap, stack.push(x, y, 0, 0)));
        return stack.pushScalar(-v - z);
      };
      const r = (stack: VecStack, pos: number, normal: number) => {
        const fromEye = stack.sub(pos, stack.push(0.5, 0.5, -1, 0));
        const reflect = stack.normalize(stack.reflect(fromEye, normal));
        const diffuse = stack.dot(normal, toLight);
        const specular = Math.pow(Math.max(stack.dot(toLight, reflect), 0), 20);
        const ambient = stack.callScalar(ambientOcclusion, pos, normal, shape);
        const shadow = stack.callScalar(softShadow, pos, toLight, shape);
        return stack.push(clamp(0.1 + shadow * (ambient * diffuse + specular), 0, 1), 0, 0, 1);
      };
      const plane = sdf3d(shape, r);
      renderer.set((stack: VecStack, pos: number) => stack.call(plane, pos));
    }, hmap.renderer, lightX.value, lightY.value, lightZ.value);

    handle(p, (p, s) => {
      settings.set([...props, ...s]);
    }, hmap.settings);

  }, hmap.value);


  return builder
    .renderer(renderer)
    .settings(settings)
    .dependency(hmap.value)
    .build();
}