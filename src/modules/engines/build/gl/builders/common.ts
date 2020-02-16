import { int, len2d } from '../../../../../libs/mathutils';
import { Texture } from '../../../../drawstruct';
import { BuildContext } from '../../api';
import { walllen } from '../../boardutils';
import { Board } from '../../structs';
import { slope, ZSCALE } from '../../utils';
import { BuildBuffer } from '../buffers';
import { PointSpriteBuilder, WireframeBuilder } from './renderable';
import { Tiler } from '../tiler';
import { vec4, mat4 } from '../../../../../libs_js/glmatrix';

let tmp = vec4.create();
let texMat = mat4.create();
export const gridMatrixProviderSector = (scale: number) => {
  mat4.identity(texMat);
  vec4.set(tmp, 1 / scale, 1 / scale, 1, 1);
  mat4.scale(texMat, texMat, tmp);
  mat4.rotateX(texMat, texMat, Math.PI / 2);
  return texMat;
}

export function createGridMatrixProviderWall(board: Board, id: number) {
  const wall1 = board.walls[id];
  const wall2 = board.walls[wall1.point2];
  const dx = wall2.x - wall1.x;
  const dy = wall2.y - wall1.y;
  const wlen = walllen(board, id);
  return (scale: number) => {
    const d = scale / (wlen / wall1.xrepeat);
    mat4.identity(texMat);
    vec4.set(tmp, d / scale, 1 / scale, 1, 1);
    mat4.scale(texMat, texMat, tmp);
    mat4.rotateY(texMat, texMat, -Math.atan2(-dy, dx));
    vec4.set(tmp, -wall1.x, 0, -wall1.y, 0);
    return mat4.translate(texMat, texMat, tmp);
  }
}

export function buildCeilingHinge(ctx: BuildContext, sectorId: number, builder: WireframeBuilder): WireframeBuilder { return prepareHinge(ctx, sectorId, true, builder) }
export function buildFloorHinge(ctx: BuildContext, sectorId: number, builder: WireframeBuilder): WireframeBuilder { return prepareHinge(ctx, sectorId, false, builder) }

function prepareHinge(ctx: BuildContext, sectorId: number, ceiling: boolean, builder: WireframeBuilder): WireframeBuilder {
  let board = ctx.board;
  builder.mode = WebGLRenderingContext.TRIANGLES;
  vec4.set(builder.color, 0.7, 0.7, 0.7, 0.7);
  let size = 128;
  let buff = builder.buff;
  buff.allocate(6, 24);
  let sec = board.sectors[sectorId];
  let wall1 = board.walls[sec.wallptr];
  let wall2 = board.walls[wall1.point2];
  let dx = (wall2.x - wall1.x); let dy = (wall2.y - wall1.y);
  let dl = len2d(dx, dy);
  let x = wall1.x + dx / 2; let y = wall1.y + dy / 2;
  dx /= dl; dy /= dl;
  let z = (ceiling ? sec.ceilingz : sec.floorz) / ZSCALE;
  let dz = ceiling ? -size / 2 : size / 2;
  let x1 = x - dx * size; let y1 = y - dy * size;
  let x2 = x + dx * size; let y2 = y + dy * size;
  let x3 = x1 - dy * (size / 2); let y3 = y1 + dx * (size / 2);
  let x4 = x2 - dy * (size / 2); let y4 = y2 + dx * (size / 2);
  let heinum = ceiling ? sec.ceilingheinum : sec.floorheinum;
  let s = slope(board, sectorId, x3, y3, heinum) / ZSCALE;
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
  for (let i = 0; i < text.length; i++) {
    tiler.put(i + 1, 1, text.charCodeAt(i));
    tiler.put(i + 1, 0, 3);
  }
  tiler.put(0, 0, 2);
  tiler.put(0, 1, 0);
  tiler.put(text.length + 1, 1, 1);
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
    buff.writeTc(vtxoff + 0, column, row + charTexSize);
    buff.writeTc(vtxoff + 1, column, row);
    buff.writeTc(vtxoff + 2, column + charTexSize, row);
    buff.writeTc(vtxoff + 3, column + charTexSize, row + charTexSize);
    buff.writeNormal(vtxoff + 0, xoff, yoff, 0);
    buff.writeNormal(vtxoff + 1, xoff, yoff + charH, 0);
    buff.writeNormal(vtxoff + 2, xoff + charW, yoff + charH, 0);
    buff.writeNormal(vtxoff + 3, xoff + charW, yoff, 0);
    buff.writeQuad(idxoff, vtxoff + 0, vtxoff + 1, vtxoff + 2, vtxoff + 3);

    vtxoff += 4;
    idxoff += 6;
  });
}