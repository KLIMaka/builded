import { Builders } from "../../../apis/builder";
import { BuildRenderableProvider, SectorRenderable, WallRenderable } from "../../../apis/renderable";
import { RenderablesCacheContext } from "../cache";
import { FlatBuilder, SolidBuilder, BuildersFactory } from "../common";

export class SectorSelectedBuilder extends Builders implements SectorRenderable {
  constructor(
    factory: BuildersFactory,
    readonly ceiling = factory.flat(''),
    readonly floor = factory.flat(''),
  ) { super([ceiling, floor]) }
}

export class WallSelectedBuilder extends Builders implements WallRenderable {
  constructor(
    factory: BuildersFactory,
    readonly top = factory.flat(''),
    readonly mid = factory.flat(''),
    readonly bot = factory.flat('')
  ) { super([top, mid, bot]) }
}

export function updateSectorSelected(cache: BuildRenderableProvider, ctx: RenderablesCacheContext, id: number, builder: SectorSelectedBuilder): SectorSelectedBuilder {
  builder = builder == null ? new SectorSelectedBuilder(ctx.factory) : builder;
  const sector = cache.sector(id);
  builder.ceiling.solid = <SolidBuilder>sector.ceiling;
  builder.floor.solid = <SolidBuilder>sector.floor;
  return builder;
}

export function updateWallSelected(cache: BuildRenderableProvider, ctx: RenderablesCacheContext, id: number, builder: WallSelectedBuilder): WallSelectedBuilder {
  builder = builder == null ? new WallSelectedBuilder(ctx.factory) : builder;
  const wall = cache.wall(id);
  builder.top.solid = <SolidBuilder>wall.top;
  builder.mid.solid = <SolidBuilder>wall.mid;
  builder.bot.solid = <SolidBuilder>wall.bot;
  return builder;
}

