import { isValidSectorId } from "build/board/query";
import { convertVisibility } from "build/utils";
import { mat4, vec3 } from "gl-matrix";
import { FACE_SPRITE, FLOOR_SPRITE, Sprite, WALL_SPRITE } from "../../../../../build/board/structs";
import { faceSprite, floorSprite, SpriteInfo, spriteInfo, wallSprite } from "../../../../../build/sprites";
import { rand } from "../../../../../utils/random";
import { BuildBuffer, buildVoxel } from "../../buffers";
import { RenderablesCacheContext } from "../cache";
import { SolidBuilder } from "../common";
import { VoxelData } from "build/formats/kvx";

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

function writeNormal(buff: BuildBuffer, n: number[], addDepth = rand(0.001, 0.002), off = 0) {
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

function fillBuffersForFaceSprite(sinfo: SpriteInfo, pal: number, shade: number, builder: SolidBuilder) {
  const sprite = faceSprite(sinfo);
  genSpriteQuad(sinfo.x, sinfo.y, sinfo.z,
    sprite.coords(),
    tcs(sinfo.xf, sinfo.yf),
    pal, shade, builder.buff);
  builder.type = 'SPRITE';
}

function fillBuffersForVoxel(spr: Sprite, sinfo: SpriteInfo, data: VoxelData, pal: number, shade: number, builder: SolidBuilder) {
  const hscale = sinfo.wscale;
  const xscale = hscale;
  const yscale = hscale;
  const zscale = sinfo.hscale;
  buildVoxel(spr, data, builder.buff, xscale, yscale, zscale, pal, shade);
  builder.tex = null;
  mat4.identity(builder.modelMatrix);
  mat4.translate(builder.modelMatrix, builder.modelMatrix, vec3.fromValues(sinfo.x, sinfo.z + sinfo.yo, sinfo.y));
  mat4.rotateY(builder.modelMatrix, builder.modelMatrix, Math.PI / 2 - sinfo.angRad);
  builder.type = 'VOXEL';
}

export function updateSprite(ctx: RenderablesCacheContext, sprId: number, builder: SolidBuilder): SolidBuilder {
  builder = builder == null ? ctx.factory.solid('sprite') : builder;
  const board = ctx.board();
  const spr = board.sprites[sprId];
  if (/*spr.picnum === 0 ||*/ spr.cstat.invisible || !isValidSectorId(board, spr.sectnum)) return builder;

  const sinfo = spriteInfo(board, sprId, ctx.textures.art.get());
  const shadowOff = ctx.settings.spriteShadowOff(board, sprId)
  const shade = shadowOff + spr.shade;
  const trans = spr.cstat.translucent ? spr.cstat.tranclucentReversed ? ctx.settings.trans1 : ctx.settings.trans2 : 1;
  builder.tex = ctx.textures.get(spr.picnum).get();
  builder.trans = trans;
  builder.type = 'NONREPEAT';
  builder.vis = convertVisibility(board.sectors[spr.sectnum].visibility);
  if (spr.cstat.type === FACE_SPRITE) {
    ctx.voxels.get()(board, sprId).ifPresentOrElse(
      data => fillBuffersForVoxel(spr, sinfo, data, spr.pal, shade, builder),
      () => fillBuffersForFaceSprite(sinfo, spr.pal, shade, builder))
  } else if (spr.cstat.type === WALL_SPRITE) {
    ctx.voxels.get()(board, sprId).ifPresentOrElse(
      data => fillBuffersForVoxel(spr, sinfo, data, spr.pal, shade, builder),
      () => fillbuffersForWallSprite(sinfo, spr.cstat.onesided, spr.pal, shade, builder))
  } else if (spr.cstat.type === FLOOR_SPRITE) {
    fillbuffersForFloorSprite(sinfo, spr.cstat.onesided, spr.pal, shade, builder);
  }

  return builder;
}
