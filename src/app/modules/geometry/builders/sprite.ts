import { FACE_SPRITE, FLOOR_SPRITE, WALL_SPRITE } from "../../../../build/board/structs";
import { ang2vec, spriteAngle, ZSCALE } from "../../../../build/utils";
import { Vec3Array } from "../../../../libs_js/glmatrix";
import { rand } from "../../../../utils/random";
import { BuildBuffer } from "../../gl/buffers";
import { RenderablesCacheContext } from "../cache";
import { SolidBuilder, Type } from "../common";

function normals(n: Vec3Array) {
  return [n[0], n[1], n[2], n[0], n[1], n[2], n[0], n[1], n[2], n[0], n[1], n[2]];
}

function writePos(buff: BuildBuffer, c: number[], off = 0) {
  buff.writePos(off + 0, c[0], c[2], c[1]);
  buff.writePos(off + 1, c[3], c[5], c[4]);
  buff.writePos(off + 2, c[6], c[8], c[7]);
  buff.writePos(off + 3, c[9], c[11], c[10]);
}

function writeTc(buff: BuildBuffer, t: number[], pal: number, shade: number, off = 0) {
  buff.writeTcLighting(off + 0, t[0], t[1], pal, shade);
  buff.writeTcLighting(off + 1, t[2], t[3], pal, shade);
  buff.writeTcLighting(off + 2, t[4], t[5], pal, shade);
  buff.writeTcLighting(off + 3, t[6], t[7], pal, shade);
}

function writeNormal(buff: BuildBuffer, n: number[], addDepth = rand(72, 90), off = 0) {
  buff.writeNormal(off + 0, n[0], n[1], n[2], addDepth);
  buff.writeNormal(off + 1, n[3], n[4], n[5], addDepth);
  buff.writeNormal(off + 2, n[6], n[7], n[8], addDepth);
  buff.writeNormal(off + 3, n[9], n[10], n[11], addDepth);
}

function genQuad(c: number[], n: number[], tc: number[], pal: number, shade: number, buff: BuildBuffer, onesided: number = 1) {
  buff.allocate(4, onesided ? 6 : 12);

  writePos(buff, c);
  writeTc(buff, tc, pal, shade);
  writeNormal(buff, n);

  buff.writeQuad(0, 0, 1, 2, 3);
  if (!onesided)
    buff.writeQuad(6, 3, 2, 1, 0);
}

function fillbuffersForWallSprite(
  x: number, y: number, z: number, xo: number, yo: number, hw: number, hh: number, ang: number, xf: number, yf: number,
  onesided: number, pal: number, shade: number, renderable: SolidBuilder) {
  const dx = Math.sin(ang) * hw;
  const dy = Math.cos(ang) * hw;
  genQuad([
    x - dx, y - dy, z - hh + yo,
    x + dx, y + dy, z - hh + yo,
    x + dx, y + dy, z + hh + yo,
    x - dx, y - dy, z + hh + yo],
    normals(ang2vec(ang)), [
    xf ? 0 : 1, yf ? 0 : 1,
    xf ? 1 : 0, yf ? 0 : 1,
    xf ? 1 : 0, yf ? 1 : 0,
    xf ? 0 : 1, yf ? 1 : 0],
    pal, shade,
    renderable.buff, onesided);
}

function fillbuffersForFloorSprite(x: number, y: number, z: number, xo: number, yo: number, hw: number, hh: number, ang: number, xf: number, yf: number,
  onesided: number, pal: number, shade: number, renderable: SolidBuilder) {
  const dwx = Math.sin(ang) * hw;
  const dwy = Math.cos(ang) * hw;
  const dhx = Math.sin(ang + Math.PI / 2) * hh;
  const dhy = Math.cos(ang + Math.PI / 2) * hh;

  genQuad([
    x - dwx - dhx, y - dwy - dhy, z,
    x + dwx - dhx, y + dwy - dhy, z,
    x + dwx + dhx, y + dwy + dhy, z,
    x - dwx + dhx, y - dwy + dhy, z],
    normals([0, 1, 0]), [
    xf ? 0 : 1, yf ? 0 : 1,
    xf ? 1 : 0, yf ? 0 : 1,
    xf ? 1 : 0, yf ? 1 : 0,
    xf ? 0 : 1, yf ? 1 : 0],
    pal, shade,
    renderable.buff, onesided);
}

function genSpriteQuad(x: number, y: number, z: number, n: number[], t: number[], pal: number, shade: number, buff: BuildBuffer) {
  buff.allocate(4, 6);
  writePos(buff, [x, y, z, x, y, z, x, y, z, x, y, z]);
  writeTc(buff, t, pal, shade);
  writeNormal(buff, n);

  // writePos(buff, [x, y, z, x, y, z, x, y, z, x, y, z], 4);
  // writeTc(buff, t, 0, 63, 4);
  // writeNormal(buff, shadowScale(n), addDepth - 16, 4);

  buff.writeQuad(0, 0, 1, 2, 3);
  // buff.writeQuad(6, 4, 5, 6, 7);
}

function shadowScale(n: number[]): number[] {
  const y1 = n[1];
  const y2 = n[7];
  const dy = Math.abs(y1 - y2);
  n[1] = y2 + dy * 0.2;
  n[4] = y2 + dy * 0.2;
  return n;
}

function fillBuffersForFaceSprite(x: number, y: number, z: number, xo: number, yo: number, hw: number, hh: number, xf: number, yf: number, pal: number, shade: number, renderable: SolidBuilder) {
  const xfmul = xf ? -1 : 1;
  const yfmul = yf ? -1 : 1;
  genSpriteQuad(x, y, z, [
    -hw * xfmul + xo, +hh * yfmul + yo, 0,
    +hw * xfmul + xo, +hh * yfmul + yo, 0,
    +hw * xfmul + xo, -hh * yfmul + yo, 0,
    -hw * xfmul + xo, -hh * yfmul + yo, 0
  ], [0, 0, 1, 0, 1, 1, 0, 1],
    pal, shade, renderable.buff);
}

export function updateSprite(ctx: RenderablesCacheContext, sprId: number, builder: SolidBuilder): SolidBuilder {
  builder = builder == null ? ctx.factory.solid('sprite') : builder;
  const board = ctx.board();
  const spr = board.sprites[sprId];
  if (spr.picnum == 0 || spr.cstat.invisible) return builder;

  const x = spr.x;
  const y = spr.y;
  const z = spr.z / ZSCALE;
  const info = ctx.art.getInfo(spr.picnum);
  const tex = ctx.art.get(spr.picnum);
  const w = (info.w * spr.xrepeat) / 4;
  const hw = w / 2;
  const h = (info.h * spr.yrepeat) / 4;
  const hh = h / 2;
  const ang = spriteAngle(spr.ang);
  const xo = (info.attrs.xoff * spr.xrepeat) / 4;
  const yo = (info.attrs.yoff * spr.yrepeat) / 4 + (spr.cstat.realCenter ? 0 : hh);
  const xf = spr.cstat.xflip;
  const yf = spr.cstat.yflip;
  const sec = board.sectors[spr.sectnum];
  const sectorShade = sec && sec.ceilingstat.parallaxing ? 0 : sec.floorshade;
  const shade = sectorShade + spr.shade;
  const trans = spr.cstat.translucent ? spr.cstat.tranclucentReversed ? 0.66 : 0.33 : 1;
  builder.tex = tex;
  builder.trans = trans;
  builder.type = Type.NONREPEAT;

  if (spr.cstat.type == FACE_SPRITE) {
    fillBuffersForFaceSprite(x, y, z, xo, yo, hw, hh, xf, yf, spr.pal, shade, builder);
    builder.type = Type.SPRITE;
  } else if (spr.cstat.type == WALL_SPRITE) {
    fillbuffersForWallSprite(x, y, z, xo, yo, hw, hh, ang, xf, yf, spr.cstat.onesided, spr.pal, shade, builder);
  } else if (spr.cstat.type == FLOOR_SPRITE) {
    fillbuffersForFloorSprite(x, y, z, xo, yo, hw, hh, ang, xf, yf, spr.cstat.onesided, spr.pal, shade, builder);
  }

  return builder;
}
