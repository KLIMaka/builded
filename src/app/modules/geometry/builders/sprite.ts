import { FACE_SPRITE, FLOOR_SPRITE, WALL_SPRITE } from "../../../../build/board/structs";
import { ang2vec, spriteAngle, ZSCALE } from "../../../../build/utils";
import { mat4, Mat4Array, Vec3Array, vec4 } from "../../../../libs_js/glmatrix";
import { BuildBuffer } from "../../gl/buffers";
import { RenderablesCacheContext } from "../cache";
import { SolidBuilder, Type } from "../common";

function normals(n: Vec3Array) {
  return [n[0], n[1], n[2], n[0], n[1], n[2], n[0], n[1], n[2], n[0], n[1], n[2]];
}

function writePos(buff: BuildBuffer, c: number[]) {
  buff.writePos(0, c[0], c[2], c[1]);
  buff.writePos(1, c[3], c[5], c[4]);
  buff.writePos(2, c[6], c[8], c[7]);
  buff.writePos(3, c[9], c[11], c[10]);
}

const tc_ = vec4.create();
function writeTransformTc(buff: BuildBuffer, t: Mat4Array, c: number[], pal: number, shade: number) {
  vec4.transformMat4(tc_, vec4.set(tc_, c[0], c[2], c[1], 1), t);
  buff.writeTcLighting(0, tc_[0], tc_[1], pal, shade);
  vec4.transformMat4(tc_, vec4.set(tc_, c[3], c[5], c[4], 1), t);
  buff.writeTcLighting(1, tc_[0], tc_[1], pal, shade);
  vec4.transformMat4(tc_, vec4.set(tc_, c[6], c[8], c[7], 1), t);
  buff.writeTcLighting(2, tc_[0], tc_[1], pal, shade);
  vec4.transformMat4(tc_, vec4.set(tc_, c[9], c[11], c[10], 1), t);
  buff.writeTcLighting(3, tc_[0], tc_[1], pal, shade);
}

function writeTc(buff: BuildBuffer, t: number[], pal: number, shade: number) {
  buff.writeTcLighting(0, t[0], t[1], pal, shade);
  buff.writeTcLighting(1, t[2], t[3], pal, shade);
  buff.writeTcLighting(2, t[4], t[5], pal, shade);
  buff.writeTcLighting(3, t[6], t[7], pal, shade);
}

function writeNormal(buff: BuildBuffer, n: number[]) {
  buff.writeNormal(0, n[0], n[1], n[2]);
  buff.writeNormal(1, n[3], n[4], n[5]);
  buff.writeNormal(2, n[6], n[7], n[8]);
  buff.writeNormal(3, n[9], n[10], n[11]);
}

function genQuad(c: number[], n: number[], t: Mat4Array, pal: number, shade: number, buff: BuildBuffer, onesided: number = 1) {
  buff.allocate(4, onesided ? 6 : 12);

  writePos(buff, c);
  writeTransformTc(buff, t, c, pal, shade);
  writeNormal(buff, n);

  buff.writeQuad(0, 0, 1, 2, 3);
  if (!onesided)
    buff.writeQuad(6, 3, 2, 1, 0);
}

const texMat_ = mat4.create();
function fillbuffersForWallSprite(
  x: number, y: number, z: number, xo: number, yo: number, hw: number, hh: number, ang: number, xf: number, yf: number,
  onesided: number, pal: number, shade: number, renderable: SolidBuilder) {
  const dx = Math.sin(ang) * hw;
  const dy = Math.cos(ang) * hw;

  const xs = xf ? -1.0 : 1.0;
  const ys = yf ? -1.0 : 1.0;
  const texMat = texMat_;
  mat4.identity(texMat);
  mat4.scale(texMat, texMat, [xs / (hw * 2), -ys / (hh * 2), 1, 1]);
  mat4.rotateY(texMat, texMat, -ang - Math.PI / 2);
  mat4.translate(texMat, texMat, [-x - xs * dx, -z - ys * hh - yo, -y - xs * dy, 0]);

  genQuad([
    x - dx, y - dy, z - hh + yo,
    x + dx, y + dy, z - hh + yo,
    x + dx, y + dy, z + hh + yo,
    x - dx, y - dy, z + hh + yo],
    normals(ang2vec(ang)), texMat,
    pal, shade,
    renderable.buff, onesided);

}

function fillbuffersForFloorSprite(x: number, y: number, z: number, xo: number, yo: number, hw: number, hh: number, ang: number, xf: number, yf: number,
  onesided: number, pal: number, shade: number, renderable: SolidBuilder) {
  const dwx = Math.sin(ang) * hw;
  const dwy = Math.cos(ang) * hw;
  const dhx = Math.sin(ang + Math.PI / 2) * hh;
  const dhy = Math.cos(ang + Math.PI / 2) * hh;
  const s = !(xf || yf) ? 1 : -1;

  const xs = xf ? -1.0 : 1.0;
  const ys = yf ? -1.0 : 1.0;
  const texMat = texMat_;
  mat4.identity(texMat);
  mat4.scale(texMat, texMat, [xs / (hw * 2), ys / (hh * 2), 1, 1]);
  mat4.translate(texMat, texMat, [hw, hh, 0, 0]);
  mat4.rotateZ(texMat, texMat, ang - Math.PI / 2);
  mat4.translate(texMat, texMat, [-x, -y, 0, 0]);
  mat4.rotateX(texMat, texMat, -Math.PI / 2);

  genQuad([
    x - dwx - dhx, y - dwy - dhy, z,
    x + s * (-dwx + dhx), y + s * (-dwy + dhy), z,
    x + dwx + dhx, y + dwy + dhy, z,
    x + s * (dwx - dhx), y + s * (dwy - dhy), z],
    normals([0, s, 0]), texMat,
    pal, shade,
    renderable.buff, onesided);

}

function genSpriteQuad(x: number, y: number, z: number, n: number[], t: number[], pal: number, shade: number, buff: BuildBuffer) {
  buff.allocate(4, 12);

  writePos(buff, [x, y, z, x, y, z, x, y, z, x, y, z]);
  writeTc(buff, t, pal, shade);
  writeNormal(buff, n);

  buff.writeQuad(0, 0, 1, 2, 3);
  buff.writeQuad(6, 3, 2, 1, 0);
}

function fillBuffersForFaceSprite(x: number, y: number, z: number, xo: number, yo: number, hw: number, hh: number, xf: number, yf: number, pal: number, shade: number, renderable: SolidBuilder) {
  const texMat = texMat_;
  mat4.identity(texMat);
  mat4.scale(texMat, texMat, [1 / (hw * 2), -1 / (hh * 2), 1, 1]);
  mat4.translate(texMat, texMat, [hw - xo, -hh - yo, 0, 0]);

  genSpriteQuad(x, y, z, [
    -hw + xo, +hh + yo, 0,
    +hw + xo, +hh + yo, 0,
    +hw + xo, -hh + yo, 0,
    -hw + xo, -hh + yo, 0
  ], [0, 0, 1, 0, 1, 1, 0, 1],
    pal, shade, renderable.buff);
}

export function updateSprite(ctx: RenderablesCacheContext, sprId: number, builder: SolidBuilder): SolidBuilder {
  builder = builder == null ? ctx.factory.solid('sprite') : builder;
  const board = ctx.board();
  const spr = board.sprites[sprId];
  if (spr.picnum == 0 || spr.cstat.invisible)
    return builder;

  const x = spr.x; const y = spr.y; const z = spr.z / ZSCALE;
  const info = ctx.art.getInfo(spr.picnum);
  const tex = ctx.art.get(spr.picnum);
  const w = (info.w * spr.xrepeat) / 4; const hw = w >> 1;
  const h = (info.h * spr.yrepeat) / 4; const hh = h >> 1;
  const ang = spriteAngle(spr.ang);
  const xo = (info.attrs.xoff * spr.xrepeat) / 4;
  const yo = (info.attrs.yoff * spr.yrepeat) / 4 + (spr.cstat.realCenter ? 0 : hh);
  const xf = spr.cstat.xflip; const yf = spr.cstat.yflip;
  const sec = board.sectors[spr.sectnum];
  const sectorShade = sec ? sec.floorshade : spr.shade;
  const shade = spr.shade == -8 ? sectorShade : spr.shade;
  const trans = spr.cstat.translucent ? spr.cstat.tranclucentReversed ? 0.66 : 0.33 : 1;
  builder.tex = tex;
  builder.trans = trans;

  if (spr.cstat.type == FACE_SPRITE) {
    fillBuffersForFaceSprite(x, y, z, xo, yo, hw, hh, xf, yf, spr.pal, shade, builder);
    builder.type = Type.FACE;
  } else if (spr.cstat.type == WALL_SPRITE) {
    fillbuffersForWallSprite(x, y, z, xo, yo, hw, hh, ang, xf, yf, spr.cstat.onesided, spr.pal, shade, builder);
  } else if (spr.cstat.type == FLOOR_SPRITE) {
    fillbuffersForFloorSprite(x, y, z, xo, yo, hw, hh, ang, xf, yf, spr.cstat.onesided, spr.pal, shade, builder);
  }

  return builder;
}
