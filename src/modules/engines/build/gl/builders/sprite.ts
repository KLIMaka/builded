import { BuildContext } from "../../api";
import { SolidBuilder, Type } from "./renderable";
import { ZSCALE, spriteAngle, ang2vec } from "../../utils";
import { FACE_SPRITE, WALL_SPRITE, FLOOR_SPRITE } from "../../structs";
import { mat4, Vec3Array, Mat4Array, vec4 } from "../../../../../libs_js/glmatrix";
import { BuildBuffer } from "../buffers";

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
function writeTransformTc(buff: BuildBuffer, t: Mat4Array, c: number[]) {
  vec4.transformMat4(tc_, vec4.set(tc_, c[0], c[2], c[1], 1), t);
  buff.writeTc(0, tc_[0], tc_[1]);
  vec4.transformMat4(tc_, vec4.set(tc_, c[3], c[5], c[4], 1), t);
  buff.writeTc(1, tc_[0], tc_[1]);
  vec4.transformMat4(tc_, vec4.set(tc_, c[6], c[8], c[7], 1), t);
  buff.writeTc(2, tc_[0], tc_[1]);
  vec4.transformMat4(tc_, vec4.set(tc_, c[9], c[11], c[10], 1), t);
  buff.writeTc(3, tc_[0], tc_[1]);
}

function writeTc(buff: BuildBuffer, t: number[]) {
  buff.writeTc(0, t[0], t[1]);
  buff.writeTc(1, t[2], t[3]);
  buff.writeTc(2, t[4], t[5]);
  buff.writeTc(3, t[6], t[7]);
}

function writeNormal(buff: BuildBuffer, n: number[]) {
  buff.writeNormal(0, n[0], n[1], n[2]);
  buff.writeNormal(1, n[3], n[4], n[5]);
  buff.writeNormal(2, n[6], n[7], n[8]);
  buff.writeNormal(3, n[9], n[10], n[11]);
}

function genQuad(c: number[], n: number[], t: Mat4Array, buff: BuildBuffer, onesided: number = 1) {
  buff.allocate(4, onesided ? 6 : 12);

  writePos(buff, c);
  writeTransformTc(buff, t, c);
  writeNormal(buff, n);

  buff.writeQuad(0, 0, 1, 2, 3);
  if (!onesided)
    buff.writeQuad(6, 3, 2, 1, 0);
}

const texMat_ = mat4.create();
function fillbuffersForWallSprite(x: number, y: number, z: number, xo: number, yo: number, hw: number, hh: number, ang: number, xf: number, yf: number, onesided: number, renderable: SolidBuilder) {
  let dx = Math.sin(ang) * hw;
  let dy = Math.cos(ang) * hw;

  let xs = xf ? -1.0 : 1.0;
  let ys = yf ? -1.0 : 1.0;
  let texMat = texMat_;
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
    renderable.buff, onesided);

}

function fillbuffersForFloorSprite(x: number, y: number, z: number, xo: number, yo: number, hw: number, hh: number, ang: number, xf: number, yf: number, onesided: number, renderable: SolidBuilder) {
  let dwx = Math.sin(ang) * hw;
  let dwy = Math.cos(ang) * hw;
  let dhx = Math.sin(ang + Math.PI / 2) * hh;
  let dhy = Math.cos(ang + Math.PI / 2) * hh;
  let s = !(xf || yf) ? 1 : -1;

  let xs = xf ? -1.0 : 1.0;
  let ys = yf ? -1.0 : 1.0;
  let texMat = texMat_;
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
    renderable.buff, onesided);

}

function genSpriteQuad(x: number, y: number, z: number, n: number[], t: number[], buff: BuildBuffer) {
  buff.allocate(4, 12);

  writePos(buff, [x, y, z, x, y, z, x, y, z, x, y, z]);
  writeTc(buff, t);
  writeNormal(buff, n);

  buff.writeQuad(0, 0, 1, 2, 3);
  buff.writeQuad(6, 3, 2, 1, 0);
}

function fillBuffersForFaceSprite(x: number, y: number, z: number, xo: number, yo: number, hw: number, hh: number, xf: number, yf: number, renderable: SolidBuilder) {
  const texMat = texMat_;
  mat4.identity(texMat);
  mat4.scale(texMat, texMat, [1 / (hw * 2), -1 / (hh * 2), 1, 1]);
  mat4.translate(texMat, texMat, [hw - xo, -hh - yo, 0, 0]);

  genSpriteQuad(x, y, z, [
    -hw + xo, +hh + yo, 0,
    +hw + xo, +hh + yo, 0,
    +hw + xo, -hh + yo, 0,
    -hw + xo, -hh + yo, 0
  ], [0, 0, 1, 0, 1, 1, 0, 1], renderable.buff);
}

export function updateSprite(ctx: BuildContext, sprId: number, builder: SolidBuilder): SolidBuilder {
  builder = builder == null ? new SolidBuilder() : builder;
  let spr = ctx.board.sprites[sprId];
  if (spr.picnum == 0 || spr.cstat.invisible)
    return builder;

  let x = spr.x; let y = spr.y; let z = spr.z / ZSCALE;
  let info = ctx.art.getInfo(spr.picnum);
  let tex = ctx.art.get(spr.picnum);
  let w = (info.w * spr.xrepeat) / 4; let hw = w >> 1;
  let h = (info.h * spr.yrepeat) / 4; let hh = h >> 1;
  let ang = spriteAngle(spr.ang);
  let xo = (info.attrs.xoff * spr.xrepeat) / 4;
  let yo = (info.attrs.yoff * spr.yrepeat) / 4 + (spr.cstat.realCenter ? 0 : hh);
  let xf = spr.cstat.xflip; let yf = spr.cstat.yflip;
  let sec = ctx.board.sectors[spr.sectnum];
  let sectorShade = sec ? sec.floorshade : spr.shade;
  let shade = spr.shade == -8 ? sectorShade : spr.shade;
  let trans = (spr.cstat.translucent || spr.cstat.tranclucentReversed) ? 0.6 : 1;
  builder.tex = tex;
  builder.shade = shade;
  builder.pal = spr.pal;
  builder.trans = trans;

  if (spr.cstat.type == FACE_SPRITE) {
    fillBuffersForFaceSprite(x, y, z, xo, yo, hw, hh, xf, yf, builder);
    builder.type = Type.FACE;
  } else if (spr.cstat.type == WALL_SPRITE) {
    fillbuffersForWallSprite(x, y, z, xo, yo, hw, hh, ang, xf, yf, spr.cstat.onesided, builder);
  } else if (spr.cstat.type == FLOOR_SPRITE) {
    fillbuffersForFloorSprite(x, y, z, xo, yo, hw, hh, ang, xf, yf, spr.cstat.onesided, builder);
  }

  return builder;
}
