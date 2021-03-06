import { BOARD } from "../../app/apis/app";
import { RorLink, RorLinks } from "../../app/modules/view/boardrenderer3d";
import { Injector } from "../../utils/injector";
import { Sprite } from "../board/structs";
import { BloodBoard } from "./structs";
import { BUS, Handle, MessageHandlerReflective } from "../../app/apis/handler";
import { LoadBoard } from "../../app/edit/messages";

export const MIRROR_PIC = 504;

function isUpperLink(spr: Sprite) {
  return spr.lotag == 11 || spr.lotag == 7 || spr.lotag == 9 || spr.lotag == 13;
}

function isLowerLink(spr: Sprite) {
  return spr.lotag == 12 || spr.lotag == 6 || spr.lotag == 10 || spr.lotag == 14;
}

export const BloodImplementationConstructor = (() => {
  let handle: Handle;
  return {
    start: async (injector: Injector) => {
      const board = await injector.getInstance(BOARD);
      const bus = await injector.getInstance(BUS);
      let rorLinks = loadRorLinks(<BloodBoard>board());
      handle = bus.connect(new class extends MessageHandlerReflective {
        LoadBoard(msg: LoadBoard) {
          rorLinks = loadRorLinks(<BloodBoard>msg.board);
        }
      })
      return {
        rorLinks: () => rorLinks,
        isMirrorPic(picnum: number) { return picnum == MIRROR_PIC },
      }
    },
    stop: async (injector: Injector) => {
      const bus = await injector.getInstance(BUS);
      bus.disconnect(handle);
    },
  }
})();

export function loadRorLinks(board: BloodBoard): RorLinks {
  const linkRegistry = {};
  for (let s = 0; s < board.numsprites; s++) {
    const spr = board.sprites[s];
    if (isUpperLink(spr) || isLowerLink(spr)) {
      const id = spr.extraData.data1;
      let links = linkRegistry[id];
      if (links == undefined) {
        links = [];
        linkRegistry[id] = links;
      }
      links.push(s);
    }
  }

  const links = new RorLinks();
  for (const linkId in linkRegistry) {
    const spriteIds = linkRegistry[linkId];
    if (spriteIds.length != 2)
      throw new Error('Invalid link in sprites: ' + spriteIds);
    let [s1, s2] = spriteIds;
    let spr1 = board.sprites[s1];
    let spr2 = board.sprites[s2];
    if (!isUpperLink(spr1)) {
      [s1, s2] = [s2, s1];
      [spr1, spr2] = [spr2, spr1];
    }
    if (board.sectors[spr1.sectnum].floorpicnum == MIRROR_PIC)
      links.floorLinks[spr1.sectnum] = new RorLink(s1, s2);
    if (board.sectors[spr2.sectnum].ceilingpicnum == MIRROR_PIC)
      links.ceilLinks[spr2.sectnum] = new RorLink(s2, s1);
  }
  return links;
}