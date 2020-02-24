import { Builders } from "../../../apis/builder";
import { ClusterRenderable } from "../../../apis/renderable";
import { RenderablesCacheContext } from "../cache";
import { BuildersFactory } from "../common";

export class ClusterBuilder extends Builders implements ClusterRenderable {
  constructor(
    factory: BuildersFactory,
    readonly solids = factory.solid('cluster'),
    readonly sprites = null,
    readonly transSprites = null,
    readonly transSolids = null
  ) { super([]) }
}

export function updateCluster(ctx: RenderablesCacheContext, sectorId: number, builder: ClusterBuilder): ClusterBuilder {
  return null;
}