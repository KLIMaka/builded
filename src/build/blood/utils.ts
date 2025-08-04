import { iter } from "ts-utils/iter";
import { second } from "ts-utils/types";
import { RorLink, RorLinks } from "app/apis/engine";
import { vec3 } from "gl-matrix";
import { Sprite } from "../board/structs";
import { BloodBoard } from "./structs";
import { slope } from "build/utils";

export const MIRROR_PIC = 504;

function isUpperLink(spr: Sprite) { // floor
  return spr.lotag === 11 || spr.lotag === 9 || spr.lotag === 13 || spr.lotag === 7;
}

function isLowerLink(spr: Sprite) { // ceiling
  return spr.lotag === 12 || spr.lotag === 10 || spr.lotag === 14 || spr.lotag === 6;
}

export function loadRorLinks(board: BloodBoard): RorLinks {
  const linkRegistry = iter(board.sprites)
    .enumerate()
    .filter(([s, _]) => isUpperLink(s) || isLowerLink(s))
    .group(([s, _]) => s.extraData.data1, second);

  const floorLinks = new Map<number, RorLink>();
  const ceilingLinks = new Map<number, RorLink>();
  for (const spriteIds of linkRegistry.values()) {
    if (spriteIds.length !== 2) continue;
    let [s1, s2] = spriteIds;
    let spr1 = board.sprites[s1];
    let spr2 = board.sprites[s2];
    if (isUpperLink(spr1)) {
      [s1, s2] = [s2, s1];
      [spr1, spr2] = [spr2, spr1];
    }
    if (spr1.lotag === 10 || spr1.lotag === 14) board.sectors[spr1.sectnum].ceilingstat.type = 3;
    else board.sectors[spr1.sectnum].ceilingstat.tror = 1;
    if (spr2.lotag === 9 || spr2.lotag === 13) board.sectors[spr2.sectnum].floorstat.type = 3;
    else board.sectors[spr2.sectnum].floorstat.tror = 1;
    const spr1z = slope(board, spr1.sectnum, spr1.x, spr1.y, true);
    const spr2z = slope(board, spr2.sectnum, spr2.x, spr2.y, false);
    const srcSpritePos = vec3.fromValues(spr1.x, spr1.y, spr1z);
    const dstSpritePos = vec3.fromValues(spr2.x, spr2.y, spr2z);
    const buildDiff = vec3.sub(vec3.create(), srcSpritePos, dstSpritePos);
    const ceilingTeleport = spr1.lotag === 6 && board.sectors[spr1.sectnum].ceilingpicnum !== MIRROR_PIC;
    const floorTeleport = spr2.lotag === 7 && board.sectors[spr2.sectnum].floorpicnum !== MIRROR_PIC;
    ceilingLinks.set(spr1.sectnum, { buildDiff, dstSector: spr2.sectnum, transparent: !ceilingTeleport });
    floorLinks.set(spr2.sectnum, { buildDiff: vec3.negate(vec3.create(), buildDiff), dstSector: spr1.sectnum, transparent: !floorTeleport });
  }
  const floorLink = (sectorId: number) => floorLinks.get(sectorId);
  const ceilLink = (sectorId: number) => ceilingLinks.get(sectorId);
  const hasRor = (sectorId: number) => floorLinks.has(sectorId) || ceilingLinks.has(sectorId);
  return { floorLink, ceilLink, hasRor };
}