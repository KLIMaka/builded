import { BuildContext } from "../../api";
import { joinSectors } from "../../boardutils";
import { MessageHandlerReflective } from "../../handlerapi";
import { NamedMessage, BoardInvalidate } from "../messages";

export class JoinSectors extends MessageHandlerReflective {
  private sectorId1 = -1;
  private sectorId2 = -1;

  private join(ctx: BuildContext) {
    const target = ctx.view.target();
    if (target.entity == null || !target.entity.isSector()) return;
    const sectorId = target.entity.id;
    if (this.sectorId1 == -1) {
      this.sectorId1 = sectorId;
    } else if (this.sectorId2 == -1) {
      this.sectorId2 = sectorId;
    }

    if (this.sectorId1 != -1 && this.sectorId2 != -1) {
      let result = joinSectors(ctx.board, this.sectorId1, this.sectorId2, ctx.refs);
      if (result == 0) {
        ctx.commit();
        ctx.message(new BoardInvalidate(null));
      }
      this.sectorId1 = -1;
      this.sectorId2 = -1;
    }
  }

  public NamedMessage(msg: NamedMessage, ctx: BuildContext) {
    if (msg.name == 'join_sectors') this.join(ctx);
  }
}