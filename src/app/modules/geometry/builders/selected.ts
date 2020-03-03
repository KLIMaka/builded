import { Builders } from "../../../apis/builder";
import { BuildRenderableProvider, SectorRenderable, WallRenderable } from "../../../apis/renderable";
import { RenderablesCacheContext } from "../cache";
import { FlatBuilder, SolidBuilder } from "../common";

export class SectorSelectedBuilder extends Builders implements SectorRenderable {
  constructor(
    readonly ceiling = new FlatBuilder(),
    readonly floor = new FlatBuilder(),
  ) { super([ceiling, floor]) }
}

export class WallSelectedBuilder extends Builders implements WallRenderable {
  constructor(
    readonly top = new FlatBuilder(),
    readonly mid = new FlatBuilder(),
    readonly bot = new FlatBuilder()
  ) { super([top, mid, bot]) }
}

export function updateSectorSelected(cache: BuildRenderableProvider, ctx: RenderablesCacheContext, id: number, builder: SectorSelectedBuilder): SectorSelectedBuilder {
  builder = builder == null ? new SectorSelectedBuilder() : builder;
  const sector = cache.sector(id);
  builder.ceiling.solid = <SolidBuilder>sector.ceiling;
  builder.floor.solid = <SolidBuilder>sector.floor;
  return builder;
}

export function updateWallSelected(cache: BuildRenderableProvider, ctx: RenderablesCacheContext, id: number, builder: WallSelectedBuilder): WallSelectedBuilder {
  builder = builder == null ? new WallSelectedBuilder() : builder;
  const wall = cache.wall(id);
  builder.top.solid = <SolidBuilder>wall.top;
  builder.mid.solid = <SolidBuilder>wall.mid;
  builder.bot.solid = <SolidBuilder>wall.bot;
  return builder;
}

