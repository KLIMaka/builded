import { vec4 } from "../../../../../libs_js/glmatrix";
import { BuildContext } from "../../api";
import { WallRenderable, WireframeBuilder } from "./renderable";
import { Builders } from "./api";
import { fastIterator } from "../../../../collections";

export class Wall2dBuilder extends Builders implements WallRenderable {
  constructor(
    readonly top = new WireframeBuilder(),
    readonly mid = new WireframeBuilder(),
    readonly bot = new WireframeBuilder()
  ) { super(fastIterator([top, mid, bot])) }
}

let white = vec4.fromValues(1, 1, 1, 1);
let red = vec4.fromValues(1, 0, 0, 1);
let blue = vec4.fromValues(0, 0, 1, 1);
export function updateWall2d(ctx: BuildContext, wallId: number, builder: Wall2dBuilder): Wall2dBuilder {
  builder = builder == null ? new Wall2dBuilder() : builder;

  let board = ctx.board;
  let buff = builder.mid.buff;
  buff.allocate(2, 2);
  let wall = board.walls[wallId];
  let wall2 = board.walls[wall.point2];
  buff.writePos(0, wall.x, 0, wall.y);
  buff.writePos(1, wall2.x, 0, wall2.y);
  buff.writeLine(0, 0, 1);
  vec4.copy(builder.mid.color, wall.cstat.masking ? blue : wall.nextwall == -1 ? white : red);
  return builder;
}