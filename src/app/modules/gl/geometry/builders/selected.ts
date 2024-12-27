import { Builders } from "../../../../apis/builder";
import { BuildRenderableProvider, SectorRenderable, WallRenderable } from "../../../../apis/renderable";
import { RenderablesCacheContext } from "../cache";
import { BuildersFactory, SolidBuilder } from "../common";

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
  builder.ceiling.solid = sector.ceiling as SolidBuilder;
  builder.floor.solid = sector.floor as SolidBuilder;
  return builder;
}

export function updateWallSelected(cache: BuildRenderableProvider, ctx: RenderablesCacheContext, id: number, builder: WallSelectedBuilder): WallSelectedBuilder {
  builder = builder == null ? new WallSelectedBuilder(ctx.factory) : builder;
  const wall = cache.wall(id);
  builder.top.solid = wall.top as SolidBuilder;
  builder.mid.solid = wall.mid as SolidBuilder;
  builder.bot.solid = wall.bot as SolidBuilder;
  return builder;
}

