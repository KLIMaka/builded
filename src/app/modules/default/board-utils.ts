import { Board } from "../../../build/board/structs";
import { getOrCreate } from "../../../utils/collections";
import { getInstances, Injector, Plugin } from "../../../utils/injector";
import { BOARD, BoardUtils } from "../../apis/app";
import { BUS, Handle, MessageHandlerReflective } from "../../apis/handler";
import { BoardInvalidate } from "../../edit/messages";

function groupSprites(board: Board, map: Map<number, number[]>) {
  for (let s = 0; s < board.numsprites; s++) {
    const spr = board.sprites[s];
    const sprs = getOrCreate(map, spr.sectnum, _ => new Array<number>());
    sprs.push(s);
  }
}

export const DefaultBoardUtilsConstructor: Plugin<BoardUtils> = (() => {
  let handle: Handle;
  return {
    start: async (injector: Injector) => {
      const [bus, board] = await getInstances(injector, BUS, BOARD);
      const spritesBySector = new Map<number, number[]>();
      groupSprites(board(), spritesBySector);

      handle = bus.connect(new class extends MessageHandlerReflective {
        BoardInvalidate(msg: BoardInvalidate) {
          spritesBySector.clear();
          groupSprites(board(), spritesBySector);
        }
      })

      return {
        spritesBySector(sectorId) { return spritesBySector.get(sectorId) },
      } as BoardUtils;
    },
    stop: async (injector: Injector) => {
      const bus = await injector.getInstance(BUS);
      bus.disconnect(handle);
    },
  }
})();