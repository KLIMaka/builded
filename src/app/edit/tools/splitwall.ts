import { splitWall } from "../../../build/boardutils";
import { Board } from "../../../build/structs";
import { sectorOfWall } from "../../../build/utils";
import { Injector, create } from "../../../utils/injector";
import { ArtProvider, ART, BOARD, BuildReferenceTracker, REFERENCE_TRACKER, VIEW, View } from "../../apis/app";
import { BUS, MessageBus, MessageHandlerReflective } from "../../apis/handler";
import { invalidateSectorAndWalls } from "../editutils";
import { NamedMessage } from "../messages";

export async function SplitWallModule(injector: Injector) {
  const bus = await injector.getInstance(BUS);
  bus.connect(await create(injector, SplitWall, BUS, VIEW, BOARD, ART, REFERENCE_TRACKER));
}

export class SplitWall extends MessageHandlerReflective {
  constructor(
    private bus: MessageBus,
    private view: View,
    private board: Board,
    private art: ArtProvider,
    private refs: BuildReferenceTracker,
  ) { super() }

  private run() {
    const target = this.view.snapTarget();
    if (target.entity == null || !target.entity.isWall()) return;
    const [x, y] = target.coords;
    const id = target.entity.id;

    splitWall(this.board, id, x, y, this.art, this.refs);
    // this.commit();
    let s = sectorOfWall(this.board, id);
    invalidateSectorAndWalls(s, this.board, this.bus);
    let nextsector = this.board.walls[id].nextsector;
    if (nextsector != -1) {
      invalidateSectorAndWalls(nextsector, this.board, this.bus);
    }
  }

  public NamedMessage(msg: NamedMessage) {
    if (msg.name == 'split_wall') this.run();
  }
}
