import { joinSectors } from "../../../build/boardutils";
import { Board } from "../../../build/structs";
import { create, Injector } from "../../../utils/injector";
import { BOARD, BuildReferenceTracker, REFERENCE_TRACKER, VIEW, View } from "../../apis/app";
import { BUS, MessageBus, MessageHandlerReflective } from "../../apis/handler";
import { BoardInvalidate, NamedMessage } from "../messages";

export async function JoinSectorsModule(injector: Injector) {
  const bus = await injector.getInstance(BUS);
  bus.connect(await create(injector, JoinSectors, BUS, VIEW, BOARD, REFERENCE_TRACKER));
}

export class JoinSectors extends MessageHandlerReflective {
  private sectorId1 = -1;
  private sectorId2 = -1;

  constructor(
    private bus: MessageBus,
    private view: View,
    private board: Board,
    private refs: BuildReferenceTracker,
  ) { super() }

  private join() {
    const target = this.view.target();
    if (target.entity == null || !target.entity.isSector()) return;
    const sectorId = target.entity.id;
    if (this.sectorId1 == -1) {
      this.sectorId1 = sectorId;
    } else if (this.sectorId2 == -1) {
      this.sectorId2 = sectorId;
    }

    if (this.sectorId1 != -1 && this.sectorId2 != -1) {
      let result = joinSectors(this.board, this.sectorId1, this.sectorId2, this.refs);
      if (result == 0) {
        // ctx.commit();
        this.bus.handle(new BoardInvalidate(null));
      }
      this.sectorId1 = -1;
      this.sectorId2 = -1;
    }
  }

  public NamedMessage(msg: NamedMessage) {
    if (msg.name == 'join_sectors') this.join();
  }
}