import { GridController } from "../../../app/apis/app";
import { vec3 } from "gl-matrix";
import { findFirst } from "../../../utils/collections";
import { int } from "../../../utils/mathutils";
import { slope, wallNormal } from "../../utils";
import { distanceToWallSegment } from "../distances";
import { sectorWalls } from "../loops";
import { findSector, snapWall } from "../query";
import { Board, Sprite } from "../structs";

export function moveSprite(board: Board, sprId: number, x: number, y: number, z: number): boolean {
  var spr = board.sprites[sprId];
  if (spr.x == x && spr.y == y && spr.z == z) return false;
  spr.x = x; spr.y = y; spr.z = z;
  spr.sectnum = findSector(board, x, y, spr.sectnum);
  return true;
}

function ornamentWall(board: Board, wallId: number, x: number, y: number, grid: GridController): [number, number] {
  const n = wallNormal(vec3.create(), board, wallId);
  const [nx, ny] = snapWall(board, wallId, x, y, grid)
  return [int(nx + n[0] * 4), int(ny + n[2] * 4)];
}

function selectOrnamentWall(board: Board, sectorId: number, wallId: number, x: number, y: number, z: number): [number, number] {
  const sector = board.sectors[sectorId];
  const wall = board.walls[wallId];
  if (wall.nextwall != -1) {
    const nextSectorId = wall.nextsector;
    const nextSector = board.sectors[nextSectorId];
    const f1z = slope(board, sectorId, x, y, sector.floorheinum) + sector.floorz;
    const c1z = slope(board, sectorId, x, y, sector.ceilingheinum) + sector.ceilingz;
    const f2z = slope(board, nextSectorId, x, y, nextSector.floorheinum) + nextSector.floorz;
    const c2z = slope(board, nextSectorId, x, y, nextSector.ceilingheinum) + nextSector.ceilingz;
    if ((z > f1z || z < c1z) && z <= f2z && z >= c2z) return [wall.nextwall, wall.nextsector];
    if ((z > f2z || z < c2z) && z <= f1z && z >= c1z) return [wallId, sectorId];
    return [-1, -1];
  }
  return [wallId, sectorId];
}

function tryMoveSprite(sprite: Sprite, x: number, y: number, z: number, sectorId: number): boolean {
  if (sprite.x == x && sprite.y == y && sprite.z == z && sprite.sectnum == sectorId) return false;
  sprite.x = x;
  sprite.y = y;
  sprite.z = z;
  sprite.sectnum = sectorId;
  return true;
}

export function moveSpriteX(board: Board, spriteId: number, x: number, y: number, z: number, grid: GridController): boolean {
  const sprite = board.sprites[spriteId];
  if (sprite.x == x && sprite.y == y && sprite.z == z) return false;
  const tsectorId = findSector(board, x, y, sprite.sectnum);
  const newSectorId = tsectorId == -1 ? sprite.sectnum : tsectorId;
  const d = grid.getGridSize() / 4;
  const w = findFirst(sectorWalls(board, newSectorId), w => distanceToWallSegment(board, w, x, y) <= d, -1);
  if (w != -1) {
    const ow = selectOrnamentWall(board, newSectorId, w, x, y, sprite.z);
    if (ow[0] == -1) {
      return tryMoveSprite(sprite, x, y, z, newSectorId);
    } else {
      const [nx, ny] = ornamentWall(board, ow[0], x, y, grid);
      return tryMoveSprite(sprite, nx, ny, z, ow[1]);
    }
  } else {
    if (tsectorId == -1) return false;
    return tryMoveSprite(sprite, x, y, z, newSectorId);
  }
}