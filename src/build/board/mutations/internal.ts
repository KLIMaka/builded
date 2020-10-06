import { BuildReferenceTracker } from "../../../app/apis/app";
import { Collection, forEach, range, reverse } from "../../../utils/collections";
import { iter } from "../../../utils/iter";
import { clockwise } from "../../utils";
import { isValidSectorId, isValidSpriteId } from "../query";
import { Board, Sector, Sprite } from "../structs";

export const DEFAULT_REPEAT_RATE = 128;

export function addSprite(board: Board, sprite: Sprite) {
  const newSpriteId = board.numsprites;
  board.sprites[newSpriteId] = sprite;
  board.numsprites++;
  return newSpriteId;
}

export function deleteSprite(board: Board, spriteId: number) {
  if (!isValidSpriteId(board, spriteId)) throw new Error(`Invalid spriteId: ${spriteId}`);
  for (let i = spriteId; i < board.numsprites; i++) board.sprites[i] = board.sprites[i + 1];
  board.sprites[board.numsprites - 1] = null;
  board.numsprites--;
}

export function addSector(board: Board, sector: Sector) {
  const newSectorIdx = board.numsectors;
  board.sectors[newSectorIdx] = sector;
  sector.wallptr = board.numwalls;
  sector.wallnum = 0;
  board.numsectors++;
  return newSectorIdx;
}

export function deleteSector(board: Board, sectorId: number, refs: BuildReferenceTracker) {
  if (!isValidSectorId(board, sectorId)) throw new Error(`Invalid sectorId: ${sectorId}`);
  const sector = board.sectors[sectorId];
  const wallsend = sector.wallptr + sector.wallnum;
  for (let w = sector.wallptr; w < wallsend; w++) {
    const wall = board.walls[w];
    if (wall.nextwall != -1) {
      const nextwall = board.walls[wall.nextwall];
      nextwall.nextsector = -1;
      nextwall.nextwall = -1;
    }
  }
  updateSpriteSector(board, sectorId);
  resizeWalls(board, sectorId, 0, refs);
  deleteSectorImpl(board, sectorId, refs);
}

function updateSpriteSector(board: Board, fromSector: number) {
  iter(range(0, board.numsprites))
    .map(s => board.sprites[s])
    .filter(s => s.sectnum == fromSector)
    .forEach(s => s.sectnum = -1);
}

function deleteSectorImpl(board: Board, sectorId: number, refs: BuildReferenceTracker) {
  if (board.sectors[sectorId].wallnum != 0) throw new Error(`Error while deleting sector #${sectorId}. wallnum != 0`);

  for (let w = 0; w < board.numwalls; w++) {
    const wall = board.walls[w];
    if (wall.nextsector == sectorId) throw new Error(`Error while deleting sector #${sectorId}. Wall #${w} referencing sector`);
    if (wall.nextsector > sectorId) wall.nextsector--;
  }
  for (let s = 0; s < board.numsprites; s++) {
    const spr = board.sprites[s];
    if (spr.sectnum == sectorId) throw new Error(`Error while deleting sector #${sectorId}. Sprite #${s} referencing sector`);
    if (spr.sectnum > sectorId) spr.sectnum--;
  }
  for (let s = sectorId; s < board.numsectors - 1; s++) {
    board.sectors[s] = board.sectors[s + 1];
  }
  refs.sectors.update((s) => s == sectorId ? -1 : s > sectorId ? s - 1 : s);
  board.sectors[board.numsectors - 1] = null;
  board.numsectors--;
}

function updateWallIds(afterWallId: number, size: number) {
  return (w: number) => {
    if (size < 0 && w >= afterWallId && w < afterWallId - size) return -1;
    else if (w > afterWallId) return w + size;
    return w;
  }
}

export function moveWalls(board: Board, secId: number, afterWallId: number, size: number, refs: BuildReferenceTracker) {
  if (size == 0) return;
  if (size < 0) forEach(range(afterWallId, afterWallId - size), w => board.walls[w] = null);

  for (let w = 0; w < board.numwalls; w++) {
    const wall = board.walls[w];
    if (wall == null) continue;
    if (wall.point2 > afterWallId) wall.point2 += size;
    if (wall.nextwall > afterWallId) wall.nextwall += size;
  }

  refs.walls.update(updateWallIds(afterWallId, size));

  if (size > 0) {
    const end = board.numwalls - 1;
    for (let i = end; i > afterWallId; i--) board.walls[i + size] = board.walls[i];
    for (let i = 0; i < size; i++) board.walls[i + afterWallId + 1] = null;
  } else {
    const end = board.numwalls + size;
    for (let i = afterWallId; i < end; i++) board.walls[i] = board.walls[i - size];
    for (let i = 0; i < -size; i++) board.walls[end + i] = null;
  }

  board.numwalls += size;
  board.sectors[secId].wallnum += size;
  for (let i = 0; i < board.numsectors; i++) {
    const sec = board.sectors[i];
    if (sec.wallptr >= afterWallId + 1 && i != secId) sec.wallptr += size;
  }
}

export function resizeWalls(board: Board, sectorId: number, newSize: number, refs: BuildReferenceTracker) {
  const sec = board.sectors[sectorId];
  const dw = newSize - sec.wallnum;
  if (dw == 0) return;
  if (dw > 0) {
    moveWalls(board, sectorId, sec.wallptr + sec.wallnum - 1, dw, refs);
  } else {
    moveWalls(board, sectorId, sec.wallptr + newSize, dw, refs)
  }
}
