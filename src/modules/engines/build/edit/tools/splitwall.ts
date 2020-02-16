import { BuildContext } from "../../api";
import { splitWall } from "../../boardutils";
import { MessageHandlerReflective } from "../../handlerapi";
import { sectorOfWall } from "../../utils";
import { invalidateSectorAndWalls } from "../editutils";
import { NamedMessage } from "../messages";

export class SplitWall extends MessageHandlerReflective {

  private run(ctx: BuildContext) {
    const target = ctx.view.snapTarget();
    if (target.entity == null || !target.entity.isWall()) return;
    const [x, y] = target.coords;
    const id = target.entity.id;

    splitWall(ctx.board, id, x, y, ctx.art, ctx.refs);
    ctx.commit();
    let s = sectorOfWall(ctx.board, id);
    invalidateSectorAndWalls(s, ctx);
    let nextsector = ctx.board.walls[id].nextsector;
    if (nextsector != -1) {
      invalidateSectorAndWalls(nextsector, ctx);
    }
  }

  public NamedMessage(msg: NamedMessage, ctx: BuildContext) {
    if (msg.name == 'split_wall') this.run(ctx);
  }
}
