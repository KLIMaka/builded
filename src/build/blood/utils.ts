import { getOrCreate } from "@utils/collections";
import { RorLink, RorLinks } from "app/apis/engine";
import { Sprite } from "../board/structs";
import { BloodBoard } from "./structs";

export const MIRROR_PIC = 504;

function isUpperLink(spr: Sprite) {
  return spr.lotag === 11 || spr.lotag === 7 || spr.lotag === 9 || spr.lotag === 13;
}

function isLowerLink(spr: Sprite) {
  return spr.lotag === 12 || spr.lotag === 6 || spr.lotag === 10 || spr.lotag === 14;
}

export function loadRorLinks(board: BloodBoard): RorLinks {
  const linkRegistry = new Map<number, number[]>();
  for (let s = 0; s < board.numsprites; s++) {
    const spr = board.sprites[s];
    if (isUpperLink(spr) || isLowerLink(spr)) {
      const id = spr.extraData.data1;
      const links = getOrCreate(linkRegistry, id, _ => []);
      links.push(s);
    }
  }

  const floorLinks = new Map<number, RorLink>();
  const ceilingLinks = new Map<number, RorLink>();
  for (const [_, spriteIds] of linkRegistry.entries()) {
    if (spriteIds.length !== 2)
      throw new Error('Invalid link in sprites: ' + spriteIds);
    let [s1, s2] = spriteIds;
    let spr1 = board.sprites[s1];
    let spr2 = board.sprites[s2];
    if (!isUpperLink(spr1)) {
      [s1, s2] = [s2, s1];
      [spr1, spr2] = [spr2, spr1];
    }
    if (board.sectors[spr1.sectnum].floorpicnum === MIRROR_PIC)
      floorLinks.set(spr1.sectnum, new RorLink(s1, s2));
    if (board.sectors[spr2.sectnum].ceilingpicnum === MIRROR_PIC)
      ceilingLinks.set(spr2.sectnum, new RorLink(s2, s1));
  }
  const floorLink = (sectorId: number) => floorLinks.get(sectorId);
  const ceilLink = (sectorId: number) => ceilingLinks.get(sectorId);
  const hasRor = (sectorId: number) => floorLinks.has(sectorId) || ceilingLinks.has(sectorId);
  return { floorLink, ceilLink, hasRor };
}