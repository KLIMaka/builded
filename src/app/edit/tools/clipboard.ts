import { EntityType } from "../../../build/hitscan";
import { create, lifecycle, Module, plugin } from "../../../utils/injector";
import { BOARD, BoardProvider, View, VIEW } from "../../apis/app";
import { busDisconnector } from "../../apis/handler";
import { NamedMessage, SetPicnum, Shade } from "../messages";
import { Selected, SELECTED } from "./selection";
import { DefaultTool, TOOLS_BUS } from "./toolsbus";

export async function ClipboardModule(module: Module) {
  module.bind(plugin('Clipboard'), lifecycle(async (injector, lifecycle) => {
    const bus = await injector.getInstance(TOOLS_BUS);
    const clipboard = await create(injector, Clipboard, BOARD, VIEW, SELECTED);
    lifecycle(bus.connect(clipboard), busDisconnector(bus));
  }));
}

const PICNUM = new SetPicnum(0);
const SHADE = new Shade(0, true);

export class Clipboard extends DefaultTool {
  constructor(
    private board: BoardProvider,
    private view: View,
    private selected: Selected,
  ) { super() }

  public NamedMessage(msg: NamedMessage) {
    switch (msg.name) {
      case 'copy': this.copy(); return;
      case 'paste_shade': this.selected().handle(SHADE); return;
      case 'paste_picnum': this.selected().handle(PICNUM); return;
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