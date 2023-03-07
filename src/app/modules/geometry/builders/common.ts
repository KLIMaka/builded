import { Board, Sector, Wall } from '../../../../build/board/structs';
import { slope, ZSCALE } from '../../../../build/utils';
import { mat4, vec3, vec4 } from 'gl-matrix';
import { Texture } from '../../../../utils/gl/drawstruct';
import { int, len2d } from '../../../../utils/mathutils';
import { Tiler } from '../../../../utils/tiler';
import { BuildBuffer } from '../../gl/buffers';
import { RenderablesCacheContext } from '../cache';
import { PointSpriteBuilder, WireframeBuilder } from '../common';
import { sectorOfWall, walllen } from '../../../../build/board/query';
import { DEFAULT_REPEAT_RATE } from '../../../../build/board/mutations/internal';

export const GRID_SECTOR_MATRIX = mat4.create();
mat4.identity(GRID_SECTOR_MATRIX);
mat4.rotateX(GRID_SECTOR_MATRIX, GRID_SECTOR_MATRIX, -Math.PI / 2);

export enum WallGridType { VOID, BOT, TOP, MID }
function getBaseZ(type: WallGridType, wall: Wall, sector: Sector, nextsector: Sector) {
  if (nextsector == undefined) return wall.cstat.alignBottom ? sector.floorz : sector.ceilingz;
  switch (type) {
    case WallGridType.VOID: return wall.cstat.alignBottom ? sector.floorz : sector.ceilingz;
    case WallGridType.BOT: return wall.cstat.alignBottom ? sector.ceilingz : nextsector.floorz;
    case WallGridType.TOP: return wall.cstat.alignBottom ? sector.ceilingz : nextsector.ceilingz;
    case WallGridType.MID: return wall.cstat.alignBottom ? Math.min(sector.floorz, nextsector.floorz) : Math.max(sector.ceilingz, nextsector.ceilingz);
  }
}

let tmp = vec3.create();
let texMat = mat4.create();
export function createGridWallMatrix(board: Board, id: number, type: WallGridType) {
  const wall1 = board.walls[id];
  const wall2 = board.walls[wall1.point2];
  const dx = wall2.x - wall1.x;
  const dy = wall2.y - wall1.y;
  const sector = board.sectors[sectorOfWall(board, id)];
  const nextsector = board.sectors[wall1.nextsector];
  const zbase = getBaseZ(type, wall1, sector, nextsector);
  const wlen = walllen(board, id);
  const sx = (wall1.xrepeat * DEFAULT_REPEAT_RATE) / wlen;
  const sy = wall1.yrepeat / 8;
  mat4.identity(texMat);
  mat4.scale(texMat, texMat, vec3.set(tmp, sx, sy, 1));
  mat4.rotateY(texMat, texMat, -Math.atan2(-dy, dx));
  mat4.translate(texMat, texMat, vec3.set(tmp, -wall1.x, -zbase / ZSCALE, -wall1.y));
  return texMat;
}

export function buildCeilingHinge(ctx: RenderablesCacheContext, sectorId: number, builder: WireframeBuilder): WireframeBuilder { return prepareHinge(ctx, sectorId, true, builder) }
export function buildFloorHinge(ctx: RenderablesCacheContext, sectorId: number, builder: WireframeBuilder): WireframeBuilder { return prepareHinge(ctx, sectorId, false, builder) }

function prepareHinge(ctx: RenderablesCacheContext, sectorId: number, ceiling: boolean, builder: WireframeBuilder): WireframeBuilder {
  const board = ctx.board();
  builder.mode = WebGLRenderingContext.TRIANGLES;
  vec4.set(builder.color, 0.7, 0.7, 0.7, 0.7);
  const size = 128;
  const buff = builder.buff;
  buff.allocate(6, 24);
  const sec = board.sectors[sectorId];
  const wall1 = board.walls[sec.wallptr];
  const wall2 = board.walls[wall1.point2];
  let dx = (wall2.x - wall1.x); let dy = (wall2.y - wall1.y);
  const dl = len2d(dx, dy);
  const x = wall1.x + dx / 2; const y = wall1.y + dy / 2;
  dx /= dl; dy /= dl;
  const z = (ceiling ? sec.ceilingz : sec.floorz) / ZSCALE;
  const dz = ceiling ? -size / 2 : size / 2;
  const x1 = x - dx * size; const y1 = y - dy * size;
  const x2 = x + dx * size; const y2 = y + dy * size;
  const x3 = x1 - dy * (size / 2); const y3 = y1 + dx * (size / 2);
  const x4 = x2 - dy * (size / 2); const y4 = y2 + dx * (size / 2);
  const heinum = ceiling ? sec.ceilingheinum : sec.floorheinum;
  const s = slope(board, sectorId, x3, y3, heinum) / ZSCALE;
  buff.writePos(0, x1, z, y1);
  buff.writePos(1, x2, z, y2);
  buff.writePos(2, x3, z + s, y3);
  buff.writePos(3, x4, z + s, y4);
  buff.writePos(4, x1, z + dz, y1);
  buff.writePos(5, x2, z + dz, y2);
  buff.writeQuad(0, 0, 1, 3, 2);
  buff.writeQuad(6, 2, 3, 1, 0);
  buff.writeQuad(12, 0, 1, 5, 4);
  buff.writeQuad(18, 4, 5, 1, 0);
  return builder;
}

export function text(builder: PointSpriteBuilder, text: string, posx: number, posy: number, posz: number, charW: number, charH: number, tex: Texture) {
  builder.tex = tex;
  const buff = builder.buff;
  buff.allocate((text.length * 2 + 3) * 4, (text.length * 2 + 3) * 6);
  writeText(buff, 0, text, charW, charH, posx, posy, posz);
  return builder;
}

export function writeText(buff: BuildBuffer, bufferOff: number, text: string, charW: number, charH: number, posx: number, posy: number, posz: number) {
  const tiler = new Tiler();
  for (let i = 0; i < text.length; i++) tiler.put(i + 1, 1, text.charCodeAt(i)).put(i + 1, 0, 3);
  tiler
    .put(0, 0, 2)
    .put(0, 1, 0)
    .put(text.length + 1, 1, 1);
  let vtxoff = bufferOff * 4;
  let idxoff = bufferOff * 6;
  const charTexSize = 1 / 16;
  const centerXOff = - charW * (text.length / 2 + 1);
  const centerYOff = charH / 2;
  tiler.tile((x: number, y: number, tileId: number) => {
    const row = int(tileId / 16) * charTexSize;
    const column = (tileId % 16) * charTexSize;
    const xoff = x * charW + centerXOff;
    const yoff = -y * charH + centerYOff;

    buff.writePos(vtxoff + 0, posx, posz, posy);
    buff.writePos(vtxoff + 1, posx, posz, posy);
    buff.writePos(vtxoff + 2, posx, posz, posy);
    buff.writePos(vtxoff + 3, posx, posz, posy);
    buff.writeTcLighting(vtxoff + 0, column, row + charTexSize);
    buff.writeTcLighting(vtxoff + 1, column, row);
    buff.writeTcLighting(vtxoff + 2, column + charTexSize, row);
    buff.writeTcLighting(vtxoff + 3, column + charTexSize, row + charTexSize);
    buff.writeNormal(vtxoff + 0, xoff, yoff, 0);
    buff.writeNormal(vtxoff + 1, xoff, yoff + charH, 0);
    buff.writeNormal(vtxoff + 2, xoff + charW, yoff + charH, 0);
    buff.writeNormal(vtxoff + 3, xoff + charW, yoff, 0);
    buff.writeQuad(idxoff, vtxoff + 0, vtxoff + 1, vtxoff + 2, vtxoff + 3);

    vtxoff += 4;
    idxoff += 6;
  });
}