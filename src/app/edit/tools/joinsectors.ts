import { EngineApi } from "../../../build/board/mutations/api";
import { joinSectors } from "../../../build/board/mutations/joinsectors";
import { isJoinedSectors } from "../../../build/board/query";
import { create, Module, plugin } from "../../../utils/injector";
import { BOARD, BoardProvider, BuildReferenceTracker, ENGINE_API, REFERENCE_TRACKER, VIEW, View } from "../../apis/app";
import { BUS, BusPlugin, MessageBus } from "../../apis/handler";
import { Commit, INVALIDATE_ALL, NamedMessage } from "../messages";
import { DefaultTool, TOOLS_BUS } from "./toolsbus";

export function JoinSectorsModule(module: Module) {
  module.bind(plugin('JoinSectors'), new BusPlugin(async (injector, connect) => {
    connect(await create(injector, JoinSectors, BUS, VIEW, BOARD, REFERENCE_TRACKER, ENGINE_API));
  }, TOOLS_BUS));
}

export class JoinSectors extends DefaultTool {
  private sectorId1 = -1;
  private sectorId2 = -1;

  constructor(
    private bus: MessageBus,
    private view: View,
    private board: BoardProvider,
    private refs: BuildReferenceTracker,
    private api: EngineApi
  ) { super() }

  private join() {
    const target = this.view.target();
    if (target.entity == null || !target.entity.isSector()) return;
    const sectorId = target.entity.id;
    if (this.sectorId1 == -1) {
      this.activate();
      this.sectorId1 = sectorId;
    } else if (this.sectorId2 == -1) {
      this.sectorId2 = sectorId;
    }

    if (this.sectorId1 != -1 && this.sectorId2 != -1 && !isJoinedSectors(this.board(), this.sectorId1, this.sectorId2)) this.stop();

    if (this.sectorId1 != -1 && this.sectorId2 != -1) {
      joinSectors(this.board(), this.sectorId1, this.sectorId2, this.refs, this.api);
      this.stop();
      this.bus.handle(new Commit(`Join Sectors ${this.sectorId1} + ${this.sectorId2}`));
      this.bus.handle(INVALIDATE_ALL);
    }
  }

  private stop() {
    this.sectorId1 = -1;
    this.sectorId2 = -1;
    this.deactivate();
  }

  public NamedMessage(msg: NamedMessage) {
    if (msg.name == 'join_sectors') this.join();
  }
}