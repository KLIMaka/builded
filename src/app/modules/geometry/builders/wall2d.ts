import { vec4 } from "../../../../libs_js/glmatrix";
import { Builders } from "../../../apis/builder";
import { WallRenderable } from "../../../apis/renderable";
import { RenderablesCacheContext, MASKED_WALL_COLOR, WALL_COLOR, INTERSECTOR_WALL_COLOR } from "../cache";
import { BuildersFactory } from "../common";

export class Wall2dBuilder extends Builders implements WallRenderable {
  constructor(
    factory: BuildersFactory,
    readonly top = factory.wireframe('2d'),
    readonly mid = factory.wireframe('2d'),
    readonly bot = factory.wireframe('2d')
  ) { super([top, mid, bot]) }
}

export function updateWall2d(ctx: RenderablesCacheContext, wallId: number, builder: Wall2dBuilder): Wall2dBuilder {
  builder = builder == null ? new Wall2dBuilder(ctx.factory) : builder;
  let board = ctx.board();
  let buff = builder.mid.buff;
  buff.allocate(2, 2);
  let wall = board.walls[wallId];
  let wall2 = board.walls[wall.point2];
  buff.writePos(0, wall.x, 0, wall.y);
  buff.writePos(1, wall2.x, 0, wall2.y);
  buff.writeLine(0, 0, 1);
  const state = ctx.state;
  vec4.copy(builder.mid.color, wall.cstat.masking
    ? state.get(MASKED_WALL_COLOR)
    : wall.nextwall == -1
      ? state.get(WALL_COLOR)
      : state.get(INTERSECTOR_WALL_COLOR));
  return builder;
}