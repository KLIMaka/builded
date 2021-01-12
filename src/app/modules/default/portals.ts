import { getPortals } from "../../../build/board/portalizer";
import { Board } from "../../../build/board/structs";
import { range } from "../../../utils/collections";
import { Injector } from "../../../utils/injector";
import { BOARD, STATE } from "../../apis/app";
import { BUS, Handle, MessageHandlerReflective } from "../../apis/handler";
import { BoardInvalidate, INVALIDATE_ALL, NamedMessage } from "../../edit/messages";
import { INTERSECTOR_WALL_COLOR, PORTAL_WALL_COLOR } from "../geometry/cache";

function updatePortals(board: Board): Set<number> {
  const portalWalls = new Set<number>();
  for (const s of range(0, board.numsectors)) {
    for (const { looppoint, portals } of getPortals(board, s)) {
      for (const portal of portals) {
        for (const w of portal) portalWalls.add(w);
      }
    }
  }
  return portalWalls;
}

export const DefaultPortalsConstructor = (() => {
  let handle: Handle;
  return {
    start: async (injector: Injector) => {
      const bus = await injector.getInstance(BUS);
      const board = await injector.getInstance(BOARD);
      const state = await injector.getInstance(STATE);
      let portals = new Set<number>();
      let drawPortals = false;

      handle = bus.connect(new class extends MessageHandlerReflective {
        BoardInvalidate(msg: BoardInvalidate) {
          if (msg.ent != null || !drawPortals) return;
          portals = updatePortals(board());
        }

        NamedMessage(msg: NamedMessage) {
          if (msg.name == 'toggle_draw_portals') {
            drawPortals = !drawPortals;
            state.set(INTERSECTOR_WALL_COLOR, drawPortals ? [1, 0, 0, 0] : [1, 0, 0, 1]);
            state.set(PORTAL_WALL_COLOR, drawPortals ? [1, 1, 0, 1] : [1, 0, 0, 1]);
            bus.handle(INVALIDATE_ALL);
          }
        }
      });
      return { isPortalWall: (wallId: number) => portals.has(wallId) };
    },
    stop: async (injector: Injector) => {
      const bus = await injector.getInstance(BUS);
      bus.disconnect(handle);
    },
  }
})();