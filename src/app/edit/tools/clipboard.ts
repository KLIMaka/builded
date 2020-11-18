import { EntityType } from "../../../build/hitscan";
import { create, Module } from "../../../utils/injector";
import { BOARD, BoardProvider, View, VIEW } from "../../apis/app";
import { BUS, MessageBus } from "../../apis/handler";
import { COMMIT, NamedMessage, SetPicnum, Shade } from "../messages";
import { Selected, SELECTED } from "./selection";
import { DefaultTool, TOOLS_BUS } from "./toolsbus";

export async function ClipboardModule(module: Module) {
  module.execute(async injector => {
    const bus = await injector.getInstance(TOOLS_BUS);
    bus.connect(await create(injector, Clipboard, BOARD, VIEW, SELECTED, BUS));
  });
}

const PICNUM = new SetPicnum(0);
const SHADE = new Shade(0, true);

export class Clipboard extends DefaultTool {
  constructor(
    private board: BoardProvider,
    private view: View,
    private selected: Selected,
    private bus: MessageBus
  ) { super() }

  public NamedMessage(msg: NamedMessage) {
    switch (msg.name) {
      case 'copy': this.copy(); return;
      case 'paste_shade': this.selected().handle(SHADE); this.bus.handle(COMMIT); return;
      case 'paste_picnum': this.selected().handle(PICNUM); this.bus.handle(COMMIT); return;
    }
  }

  private copy() {
    const target = this.view.target();
    const board = this.board();
    if (target.entity == null) return;
    switch (target.entity.type) {
      case EntityType.CEILING:
        SHADE.value = board.sectors[target.entity.id].ceilingshade;
        PICNUM.picnum = board.sectors[target.entity.id].ceilingpicnum;
        break;
      case EntityType.FLOOR:
        SHADE.value = board.sectors[target.entity.id].floorshade;
        PICNUM.picnum = board.sectors[target.entity.id].floorpicnum;
        break;
      case EntityType.LOWER_WALL:
      case EntityType.MID_WALL:
      case EntityType.UPPER_WALL:
        SHADE.value = board.walls[target.entity.id].shade;
        PICNUM.picnum = board.walls[target.entity.id].picnum;
        break;
      case EntityType.SPRITE:
        SHADE.value = board.sprites[target.entity.id].shade;
        PICNUM.picnum = board.sprites[target.entity.id].picnum;
        break;
    }
  }
}