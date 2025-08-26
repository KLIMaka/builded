import { RorLink, RorLinks, SectorDrawType, SectorSettings } from "app/apis/engine";
import { slope } from "build/utils";
import { vec3 } from "gl-matrix";
import { getOrCreate, range } from "ts-utils/collections";
import { iter } from "ts-utils/iter";
import { first, pair } from "ts-utils/types";
import { Sprite } from "../board/structs";
import { BloodBoard } from "./structs";

export const MIRROR_PIC = 504;
const LOWER_LINK = 6;
const UPPER_LINK = 7;
const UPPER_WATER = 9;
const LOWER_WATER = 10;
const UPPER_STACK = 11;
const LOWER_STACK = 12;
const UPPER_GOO = 13;
const LOWER_GOO = 14;

function isUpperLink(spr: Sprite) { // floor
  return spr.lotag === UPPER_GOO || spr.lotag === UPPER_LINK || spr.lotag === UPPER_STACK || spr.lotag === UPPER_WATER;
}

function isLowerLink(spr: Sprite) { // ceiling
  return spr.lotag === LOWER_GOO || spr.lotag === LOWER_LINK || spr.lotag === LOWER_STACK || spr.lotag === LOWER_WATER;
}

export function loadRorLinks(board: BloodBoard): [RorLinks, Map<number, SectorSettings>] {
  const linkRegistry = iter(range(0, board.numsprites))
    .map(s => pair(s, board.sprites[s]))
    .filter(([_, s]) => isUpperLink(s) || isLowerLink(s))
    .group(([_, s]) => s.extraData.data1, first);

  const settings = new Map<number, SectorSettings>();
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

    const drawType: SectorDrawType = spr1.lotag === LOWER_GOO || spr1.lotag === UPPER_GOO || spr1.lotag === LOWER_WATER || spr1.lotag === UPPER_WATER ? 'trans1' : 'nodraw';
    getOrCreate(settings, spr1.sectnum, _ => ({ ceiling: 'normal', floor: 'normal' })).ceiling = drawType;
    getOrCreate(settings, spr2.sectnum, _ => ({ ceiling: 'normal', floor: 'normal' })).floor = drawType;

    const spr1z = slope(board, spr1.sectnum, spr1.x, spr1.y, true);
    const spr2z = slope(board, spr2.sectnum, spr2.x, spr2.y, false);
    const srcSpritePos = vec3.fromValues(spr1.x, spr1.y, spr1z);
    const dstSpritePos = vec3.fromValues(spr2.x, spr2.y, spr2z);
    const buildDiff = vec3.sub(vec3.create(), srcSpritePos, dstSpritePos);
    const ceilingTeleport = spr1.lotag === LOWER_LINK && board.sectors[spr1.sectnum].ceilingpicnum !== MIRROR_PIC;
    const floorTeleport = spr2.lotag === UPPER_LINK && board.sectors[spr2.sectnum].floorpicnum !== MIRROR_PIC;
    ceilingLinks.set(spr1.sectnum, { buildDiff, dstSector: spr2.sectnum, transparent: !ceilingTeleport });
    floorLinks.set(spr2.sectnum, { buildDiff: vec3.negate(vec3.create(), buildDiff), dstSector: spr1.sectnum, transparent: !floorTeleport });
  }
  const floorLink = (sectorId: number) => floorLinks.get(sectorId);
  const ceilLink = (sectorId: number) => ceilingLinks.get(sectorId);
  return [{ floorLink, ceilLink }, settings];
}
