import { getWallBaseZ, sectorOfWall } from "../../../../build/board/query";
import { Wall } from "../../../../build/board/structs";
import { ArtInfo } from "../../../../build/formats/art";
import { createSlopeCalculator, getMaskedWallCoords, getWallCoords, wallNormal, ZSCALE } from "../../../../build/utils";
import { mat4, Mat4Array, vec3, Vec3Array, vec4 } from "../../../../libs_js/glmatrix";
import { len2d } from "../../../../utils/mathutils";
import { Builders } from "../../../apis/builder";
import { WallRenderable } from "../../../apis/renderable";
import { BuildBuffer } from "../../gl/buffers";
import { RenderablesCacheContext } from "../cache";
import { BuildersFactory } from "../common";

export class WallBuilder extends Builders implements WallRenderable {
  constructor(
    factory: BuildersFactory,
    readonly top = factory.solid('wall'),
    readonly mid = factory.solid('wall'),
    readonly bot = factory.solid('wall'),
    readonly tdf = factory.solid('wall')
  ) { super([top, mid, bot, tdf]) }
}

function normals(n: Vec3Array) {
  return [n[0], n[1], n[2], n[0], n[1], n[2], n[0], n[1], n[2], n[0], n[1], n[2]];
}

function applyWallTextureTransform(wall: Wall, wall2: Wall, originalWall: Wall, info: ArtInfo, base: number, texMat: Mat4Array) {
  let wall1 = wall;
  if (originalWall.cstat.xflip) [wall1, wall2] = [wall2, wall1];
  if (originalWall != wall && originalWall.cstat.swapBottoms) [wall1, wall2] = [wall2, wall1];
  const tw = info.w;
  const th = info.h;
  const dx = wall2.x - wall1.x;
  const dy = wall2.y - wall1.y;
  const tcscalex = (originalWall.xrepeat * 8) / (len2d(dx, dy) * tw);
  const tcscaley = -(originalWall.yrepeat / 8) / (th * 16) * (wall.cstat.yflip ? -1 : 1);
  const tcxoff = wall.xpanning / tw;
  const tcyoff = wall.ypanning / 256;

  mat4.identity(texMat);
  mat4.translate(texMat, texMat, [tcxoff, tcyoff, 0, 0]);
  mat4.scale(texMat, texMat, [tcscalex, tcscaley, 1, 1]);
  mat4.rotateY(texMat, texMat, -Math.atan2(-dy, dx));
  mat4.translate(texMat, texMat, [-wall1.x, -base / ZSCALE, -wall1.y, 0]);
}

function writePos(buff: BuildBuffer, c: number[]) {
  buff.writePos(0, c[0], c[2], c[1]);
  buff.writePos(1, c[3], c[5], c[4]);
  buff.writePos(2, c[6], c[8], c[7]);
  buff.writePos(3, c[9], c[11], c[10]);
}

const tc = vec4.create();
function writeTransformTc(buff: BuildBuffer, t: Mat4Array, lmt: Mat4Array, c: number[], pal: number, shade: number) {
  vec4.transformMat4(tc, vec4.set(tc, c[0], c[2], c[1], 1), t);
  buff.writeTcLighting(0, tc[0], tc[1], pal, shade);
  vec4.transformMat4(tc, vec4.set(tc, c[0], c[2], c[1], 1), lmt);
  buff.writeLightmap(0, tc[0], tc[1], 0, 0);
  vec4.transformMat4(tc, vec4.set(tc, c[3], c[5], c[4], 1), t);
  buff.writeTcLighting(1, tc[0], tc[1], pal, shade);
  vec4.transformMat4(tc, vec4.set(tc, c[3], c[5], c[4], 1), lmt);
  buff.writeLightmap(1, tc[0], tc[1], 0, 0);
  vec4.transformMat4(tc, vec4.set(tc, c[6], c[8], c[7], 1), t);
  buff.writeTcLighting(2, tc[0], tc[1], pal, shade);
  vec4.transformMat4(tc, vec4.set(tc, c[6], c[8], c[7], 1), lmt);
  buff.writeLightmap(2, tc[0], tc[1], 0, 0);
  vec4.transformMat4(tc, vec4.set(tc, c[9], c[11], c[10], 1), t);
  buff.writeTcLighting(3, tc[0], tc[1], pal, shade);
  vec4.transformMat4(tc, vec4.set(tc, c[9], c[11], c[10], 1), lmt);
  buff.writeLightmap(3, tc[0], tc[1], 0, 0);
}

function writeNormal(buff: BuildBuffer, n: number[]) {
  buff.writeNormal(0, n[0], n[1], n[2]);
  buff.writeNormal(1, n[3], n[4], n[5]);
  buff.writeNormal(2, n[6], n[7], n[8]);
  buff.writeNormal(3, n[9], n[10], n[11]);
}

function genQuad(c: number[], n: number[], t: Mat4Array, lmt: Mat4Array, pal: number, shade: number, buff: BuildBuffer) {
  buff.allocate(4, 6);
  writePos(buff, c);
  writeTransformTc(buff, t, lmt, c, pal, shade);
  writeNormal(buff, n);
  buff.writeQuad(0, 0, 1, 2, 3);
}

const wallNormal_ = vec3.create();
const texMat_ = mat4.create();
export function updateWall(ctx: RenderablesCacheContext, wallId: number, builder: WallBuilder): WallBuilder {
  builder = builder == null ? new WallBuilder(ctx.factory) : builder;
  const board = ctx.board();
  const art = ctx.art;
  const wall = board.walls[wallId];
  const sectorId = sectorOfWall(board, wallId);
  const sector = board.sectors[sectorId];
  const wall2 = board.walls[wall.point2];
  const [x1, y1] = [wall.x, wall.y];
  const [x2, y2] = [wall2.x, wall2.y];
  const tex = art.get(wall.picnum);
  const info = art.getInfo(wall.picnum);
  const slope = createSlopeCalculator(board, sectorId);
  const ceilingheinum = sector.ceilingheinum;
  const ceilingz = sector.ceilingz;
  const floorheinum = sector.floorheinum;
  const floorz = sector.floorz;
  const trans = wall.cstat.translucent ? wall.cstat.translucentReversed ? 0.66 : 0.33 : 1;
  const normal = normals(wallNormal(wallNormal_, board, wallId));

  if (wall.nextwall == -1) {
    const coords = getWallCoords(x1, y1, x2, y2, slope, slope, ceilingheinum, floorheinum, ceilingz, floorz, false);
    const base = wall.cstat.alignBottom ? floorz : ceilingz;
    applyWallTextureTransform(wall, wall2, wall, info, base, texMat_);
    genQuad(coords, normal, texMat_, ctx.lightmaps.midWall(wallId), wall.pal, wall.shade, builder.mid.buff);
    builder.mid.tex = tex;
  } else {
    const nextsector = board.sectors[wall.nextsector];
    const nextslope = createSlopeCalculator(board, wall.nextsector);
    const nextfloorz = nextsector.floorz;
    const nextceilingz = nextsector.ceilingz;
    const nextfloorheinum = nextsector.floorheinum;
    const nextceilingheinum = nextsector.ceilingheinum;

    const ceilcoords = getWallCoords(x1, y1, x2, y2, slope, nextslope, ceilingheinum, nextceilingheinum, ceilingz, nextceilingz, true);
    if (ceilcoords != null) {
      let pal = 0;
      let shade = 0;
      if (sector.ceilingstat.parallaxing && nextsector.ceilingstat.parallaxing && sector.ceilingpicnum == nextsector.ceilingpicnum) {
        builder.top.tex = art.getParallaxTexture(sector.ceilingpicnum);
        shade = sector.ceilingshade;
        pal = sector.ceilingpal;
        builder.top.parallax = 1;
      } else {
        const base = wall.cstat.alignBottom ? ceilingz : nextceilingz;
        applyWallTextureTransform(wall, wall2, wall, info, base, texMat_);
        builder.top.tex = tex;
        shade = wall.shade;
        pal = wall.pal;
      }
      genQuad(ceilcoords, normal, texMat_, ctx.lightmaps.upperWall(wallId), pal, shade, builder.top.buff);
    }

    const floorcoords = getWallCoords(x1, y1, x2, y2, nextslope, slope, nextfloorheinum, floorheinum, nextfloorz, floorz, true);
    if (floorcoords != null) {
      let pal = 0;
      let shade = 0;
      if (sector.floorstat.parallaxing && nextsector.floorstat.parallaxing && sector.floorpicnum == nextsector.floorpicnum) {
        builder.bot.tex = art.getParallaxTexture(sector.floorpicnum);
        shade = sector.floorshade;
        pal = sector.floorpal;
        builder.bot.parallax = 1;
      } else {
        const wall_ = wall.cstat.swapBottoms ? board.walls[wall.nextwall] : wall;
        const wall2_ = wall.cstat.swapBottoms ? board.walls[wall_.point2] : wall2;
        const tex_ = wall.cstat.swapBottoms ? art.get(wall_.picnum) : tex;
        const info_ = wall.cstat.swapBottoms ? art.getInfo(wall_.picnum) : info;
        const base = wall_.cstat.alignBottom ? ceilingz : nextfloorz;
        applyWallTextureTransform(wall_, wall2_, wall, info_, base, texMat_);
        builder.bot.tex = tex_;
        shade = wall_.shade;
        pal = wall_.pal;
      }
      genQuad(floorcoords, normal, texMat_, ctx.lightmaps.lowerWall(wallId), pal, shade, builder.bot.buff);
    }

    const nextwall = board.walls[wall.nextwall];
    if (wall.cstat.masking || nextwall.cstat.masking || wall.cstat.oneWay) {
      const tex1 = art.get(wall.overpicnum);
      const info1 = art.getInfo(wall.overpicnum);
      const coords = getMaskedWallCoords(x1, y1, x2, y2, slope, nextslope,
        ceilingheinum, nextceilingheinum, ceilingz, nextceilingz,
        floorheinum, nextfloorheinum, floorz, nextfloorz);
      const base = wall.cstat.alignBottom ? ceilingz : nextceilingz;
      applyWallTextureTransform(wall, wall2, wall, info1, base, texMat_);
      genQuad(coords, normal, texMat_, ctx.lightmaps.upperWall(wallId), wall.pal, wall.shade, builder.mid.buff);
      builder.mid.tex = tex1;
      builder.mid.trans = trans;
    }

    // if (nextsector.lotag == 32 && isValidSectorId(board, nextsector.hitag)) {
    //   const tds = board.sectors[nextsector.hitag];
    //   const wall3d = board.walls[tds.wallptr];
    //   const tex = art.get(wall3d.picnum);
    //   const info = art.getInfo(wall3d.picnum);
    //   const slope = createSlopeCalculator(board, wall.nextsector);
    //   const z1 = (slope(x1, y1, tds.ceilingheinum) + tds.ceilingz) / ZSCALE;
    //   const z2 = (slope(x2, y2, tds.ceilingheinum) + tds.ceilingz) / ZSCALE;
    //   const z3 = (slope(x2, y2, tds.floorheinum) + tds.floorz) / ZSCALE;
    //   const z4 = (slope(x1, y1, tds.floorheinum) + tds.floorz) / ZSCALE;
    //   const coords = [x1, y1, z1, x2, y2, z2, x2, y2, z3, x1, y1, z4];
    //   applyWallTextureTransform(wall, wall2, info, wall3d.cstat.alignBottom ? tds.floorz : tds.ceilingz, wall, texMat_);
    //   genQuad(coords, normal, texMat_, wall3d.pal, wall3d.shade, builder.tdf.buff);
    //   builder.tdf.tex = tex;
    // }
  }

  return builder;
}