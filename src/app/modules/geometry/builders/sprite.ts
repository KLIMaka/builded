import { isValidSectorId } from "build/board/query";
import { vec3 } from "gl-matrix";
import { FACE_SPRITE, FLOOR_SPRITE, WALL_SPRITE } from "../../../../build/board/structs";
import { floorSprite, SpriteInfo, spriteInfo, wallSprite } from "../../../../build/sprites";
import { rand } from "../../../../utils/random";
import { BuildBuffer } from "../../gl/buffers";
import { RenderablesCacheContext } from "../cache";
import { SolidBuilder, Type } from "../common";

const NORMAL = [0, 0, 1, 0, 1, 1, 0, 1];
const XFLIP = [1, 0, 0, 0, 0, 1, 1, 1];
const YFLIP = [0, 1, 1, 1, 1, 0, 0, 0];
const XYFLIP = [1, 1, 0, 1, 0, 0, 1, 0];

function tcs(xflip: boolean, yflip: boolean) {
  return xflip ? (yflip ? XYFLIP : XFLIP) : (yflip ? YFLIP : NORMAL);
}

function normals(n: vec3) {
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

function genQuad(c: number[], n: number[], tc: number[], pal: number, shade: number, buff: BuildBuffer, onesided: number = 1, yf = false) {
  buff.allocate(4, onesided ? 6 : 12);

  writePos(buff, c);
  writeTc(buff, tc, pal, shade);
  writeNormal(buff, n);

  if (onesided && yf) {
    buff.writeQuad(0, 3, 2, 1, 0);
  } else {
    buff.writeQuad(0, 0, 1, 2, 3);
    if (!onesided)
      buff.writeQuad(6, 3, 2, 1, 0);
  }
}

function genSpriteQuad(x: number, y: number, z: number, n: number[], t: number[], pal: number, shade: number, buff: BuildBuffer) {
  buff.allocate(4, 12);
  writePos(buff, [x, y, z, x, y, z, x, y, z, x, y, z]);
  writeTc(buff, t, pal, shade);
  writeNormal(buff, n);

  // writePos(buff, [x, y, z, x, y, z, x, y, z, x, y, z], 4);
  // writeTc(buff, t, 0, 63, 4);
  // writeNormal(buff, shadowScale(n), addDepth - 16, 4);

  buff.writeQuad(0, 0, 1, 2, 3);
  buff.writeQuad(6, 3, 2, 1, 0);
}

function fillbuffersForWallSprite(sinfo: SpriteInfo, onesided: number, pal: number, shade: number, renderable: SolidBuilder) {
  const sprite = wallSprite(sinfo);
  genQuad(sprite.coords(),
    normals(sprite.normal()),
    tcs(sinfo.xf, sinfo.yf),
    pal, shade,
    renderable.buff, onesided);
}

function fillbuffersForFloorSprite(sinfo: SpriteInfo, onesided: number, pal: number, shade: number, renderable: SolidBuilder) {
  const sprite = floorSprite(sinfo);
  genQuad(sprite.coords(),
    normals(sprite.normal()),
    tcs(sinfo.xf, !onesided && sinfo.yf),
    pal, shade,
    renderable.buff, onesided, sinfo.yf);
}

function fillBuffersForFaceSprite(sinfo: SpriteInfo, pal: number, shade: number, renderable: SolidBuilder) {
  const xfmul = sinfo.xf ? -1 : 1;
  const yfmul = sinfo.yf ? -1 : 1;
  genSpriteQuad(sinfo.x, sinfo.y, sinfo.z, [
    (-sinfo.hw - sinfo.xo) * xfmul, +sinfo.hh * yfmul + sinfo.yo, 0,
    (+sinfo.hw - sinfo.xo) * xfmul, +sinfo.hh * yfmul + sinfo.yo, 0,
    (+sinfo.hw - sinfo.xo) * xfmul, -sinfo.hh * yfmul + sinfo.yo, 0,
    (-sinfo.hw - sinfo.xo) * xfmul, -sinfo.hh * yfmul + sinfo.yo, 0
  ], NORMAL,
    pal, shade, renderable.buff);
}

export function updateSprite(ctx: RenderablesCacheContext, sprId: number, builder: SolidBuilder): SolidBuilder {
  builder = builder == null ? ctx.factory.solid('sprite') : builder;
  const board = ctx.board();
  const spr = board.sprites[sprId];
  if (spr.picnum == 0 || spr.cstat.invisible || !isValidSectorId(board, spr.sectnum)) return builder;

  const sinfo = spriteInfo(board, sprId, ctx.art);
  const sec = board.sectors[spr.sectnum];
  const sectorShade = sec && sec.ceilingstat.parallaxing ? 0 : sec.floorshade;
  const shade = sectorShade + spr.shade;
  const trans = spr.cstat.translucent ? spr.cstat.tranclucentReversed ? 0.66 : 0.33 : 1;
  builder.tex = ctx.art.get(spr.picnum);
  builder.trans = trans;
  builder.type = Type.NONREPEAT;

  if (spr.cstat.type == FACE_SPRITE) {
    fillBuffersForFaceSprite(sinfo, spr.pal, shade, builder);
    builder.type = Type.SPRITE;
  } else if (spr.cstat.type == WALL_SPRITE) {
    fillbuffersForWallSprite(sinfo, spr.cstat.onesided, spr.pal, shade, builder);
  } else if (spr.cstat.type == FLOOR_SPRITE) {
    fillbuffersForFloorSprite(sinfo, spr.cstat.onesided, spr.pal, shade, builder);
  }

  return builder;
}
