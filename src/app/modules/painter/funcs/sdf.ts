import { handle, value } from "../../../../utils/callbacks";
import { VecStack } from "../../../../utils/vecstack";
import { Context, Image } from "../api";
import { ImageBuilder, transformedParam, VOID_RENDERER } from "./common";

export function sdf(ctx: Context): Image {
  const builder = new ImageBuilder();
  const distance = transformedParam('SDF',
    ctx.imageProvider(),
    ctx.oracle(builder.object()),
    ctx.currentImageName());
  const profile = transformedParam('Profile',
    ctx.imageProvider(),
    ctx.oracle(builder.object()));

  const props = [distance.prop, profile.prop];

  const renderer = value(VOID_RENDERER);
  const settings = value(props);

  handle(null, (p, distance, profile) => {
    if (profile == null || distance == null) {
      renderer.set(VOID_RENDERER);
      settings.set(props);
      return
    }

    handle(p, (p, distance, profile) => {
      renderer.set((stack: VecStack, pos: number) => {
        const dist = stack.x(stack.call(distance, pos));
        const v = stack.x(stack.call(profile, stack.push(dist, 0, 0, 0)));
        return stack.push(v, 0, 0, 1);
      });
    }, distance.renderer, profile.renderer);

    handle(p, (p, d, pr) => {
      settings.set([...props, ...d, ...pr]);
    }, distance.settings, profile.settings);

  }, distance.value, profile.value);

  return builder
    .renderer(renderer)
    .settings(settings)
    .dependency(distance.value)
    .dependency(profile.value)
    .build();
}
