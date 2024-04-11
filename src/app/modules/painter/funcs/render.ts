import { handle, value } from "../../../../utils/callbacks";
import { clamp } from "../../../../utils/mathutils";
import { VecStack } from "../../../../utils/vecstack";
import { Context, Image, propSectionGroups } from "../api";
import { ambientOcclusion, sdf3d, softShadow } from "../sdf/sdf";
import { ImageBuilder, VOID_RENDERER, param, transformedParam } from "./common";

export function render(ctx: Context): Image {
  const builder = new ImageBuilder();
  const hmap = transformedParam(ctx.ui(), 'Height Map', ctx.imageProvider(), ctx.images(builder.object()), ctx.currentImageName());
  const scale = param(ctx.ui(), 'Scale', 1);
  const lightX = param(ctx.ui(), 'Light X', 0.7);
  const lightY = param(ctx.ui(), 'Y', 0);
  const lightZ = param(ctx.ui(), 'Z', -0.5);
  const props = propSectionGroups('Renderer', [hmap.prop], [scale.prop], [lightX.prop, lightY.prop, lightZ.prop]);

  const toLight = ctx.stack().pushGlobal(0, 0, 0, 0);

  const renderer = value(VOID_RENDERER);
  const settings = value(props);

  handle(null, (p, hmap) => {
    if (hmap == null) {
      renderer.set(VOID_RENDERER);
      settings.set(props);
      return
    }

    handle(p, (p, hmap, scale, lightX, lightY, lightZ) => {
      const stack = ctx.stack();
      stack.begin();
      stack.copy(toLight,
        stack.normalize(
          stack.sub(
            stack.push(lightX, lightY, lightZ, 0),
            stack.push(0.5, 0.5, 0, 0)
          )));
      stack.end();
      const shape = (stack: VecStack, pos: number) => {
        const v = stack.callScalar(hmap, stack.push(stack.x(pos), stack.y(pos), 0, 0)) * scale;
        return stack.pushScalar(-v - stack.z(pos));
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
    }, hmap.renderer, scale.value, lightX.value, lightY.value, lightZ.value);

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