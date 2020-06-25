import { ArtInfo } from "../../../../build/formats/art";
import { Wall } from "../../../../build/board/structs";
import { createSlopeCalculator, sectorOfWall, wallNormal, ZSCALE } from "../../../../build/utils";
import { mat4, Mat4Array, vec3, Vec3Array, vec4 } from "../../../../libs_js/glmatrix";
import { len2d, len3d } from "../../../../utils/mathutils";
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
    readonly bot = factory.solid('wall')
  ) { super([top, mid, bot]) }
}

function normals(n: Vec3Array) {
  return [n[0], n[1], n[2], n[0], n[1], n[2], n[0], n[1], n[2], n[0], n[1], n[2]];
}

function getWallCoords(x1: number, y1: number, x2: number, y2: number,
  slope: any, nextslope: any, heinum: number, nextheinum: number, z: number, nextz: number, check: boolean): number[] {
  const z1 = (slope(x1, y1, heinum) + z) / ZSCALE;
  const z2 = (slope(x2, y2, heinum) + z) / ZSCALE;
  const z3 = (nextslope(x2, y2, nextheinum) + nextz) / ZSCALE;
  const z4 = (nextslope(x1, y1, nextheinum) + nextz) / ZSCALE;
  if (check && z4 >= z1 && z3 >= z2) return null;

  if (z4 > z1) {
    const d = 1 - 1 / ((z4 - z1) / (z2 - z3) + 1);
    const x1_ = x1 + (x2 - x1) * d;
    const y1_ = y1 + (y2 - y1) * d;
    const z1_ = z1 + (z2 - z1) * d;
    return [x1_, y1_, z1_, x2, y2, z2, x2, y2, z3, x1_, y1_, z1_];
  } else if (z3 > z2) {
    const d = 1 - 1 / ((z1 - z4) / (z3 - z2) + 1);
    const x2_ = x1 + (x2 - x1) * d;
    const y2_ = y1 + (y2 - y1) * d;
    const z2_ = z1 + (z2 - z1) * d;
    return [x1, y1, z1, x2_, y2_, z2_, x2_, y2_, z2_, x1, y1, z4];
  }

  return [x1, y1, z1, x2, y2, z2, x2, y2, z3, x1, y1, z4];
}

function applyWallTextureTransform(wall: Wall, wall2: Wall, info: ArtInfo, base: number, originalWall: Wall = wall, texMat: Mat4Array) {
  let wall1 = wall;
  if (originalWall.cstat.xflip) [wall1, wall2] = [wall2, wall1];
  const flip = wall == originalWall ? 1 : -1;
  const tw = info.w;
  const th = info.h;
  const dx = wall2.x - wall1.x;
  const dy = wall2.y - wall1.y;
  const tcscalex = (wall.xrepeat * 8.0) / (flip * len2d(dx, dy) * tw);
  const tcscaley = -(wall.yrepeat / 8.0) / (th * 16.0) * (originalWall.cstat.yflip ? -1 : 1);
  const tcxoff = wall.xpanning / tw;
  const tcyoff = wall.ypanning / 256.0;

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
function writeTransformTc(buff: BuildBuffer, t: Mat4Array, c: number[], pal: number, shade: number) {
  vec4.transformMat4(tc, vec4.set(tc, c[0], c[2], c[1], 1), t);
  buff.writeTcLighting(0, tc[0], tc[1], pal, shade);
  vec4.transformMat4(tc, vec4.set(tc, c[3], c[5], c[4], 1), t);
  buff.writeTcLighting(1, tc[0], tc[1], pal, shade);
  vec4.transformMat4(tc, vec4.set(tc, c[6], c[8], c[7], 1), t);
  buff.writeTcLighting(2, tc[0], tc[1], pal, shade);
  vec4.transformMat4(tc, vec4.set(tc, c[9], c[11], c[10], 1), t);
  buff.writeTcLighting(3, tc[0], tc[1], pal, shade);
}

function writeNormal(buff: BuildBuffer, n: number[]) {
  buff.writeNormal(0, n[0], n[1], n[2]);
  buff.writeNormal(1, n[3], n[4], n[5]);
  buff.writeNormal(2, n[6], n[7], n[8]);
  buff.writeNormal(3, n[9], n[10], n[11]);
}

function genQuad(c: number[], n: number[], t: Mat4Array, pal: number, shade: number, buff: BuildBuffer) {
  buff.allocate(4, 6);
  writePos(buff, c);
  writeTransformTc(buff, t, c, pal, shade);
  writeNormal(buff, n);
  buff.writeQuad(0, 0, 1, 2, 3);
}

function getMaskedWallCoords(x1: number, y1: number, x2: number, y2: number, slope: any, nextslope: any,
  ceilheinum: number, ceilnextheinum: number, ceilz: number, ceilnextz: number,
  floorheinum: number, floornextheinum: number, floorz: number, floornextz: number): number[] {
  const currz1 = (slope(x1, y1, ceilheinum) + ceilz) / ZSCALE;
  const currz2 = (slope(x2, y2, ceilheinum) + ceilz) / ZSCALE;
  const currz3 = (slope(x2, y2, floorheinum) + floorz) / ZSCALE;
  const currz4 = (slope(x1, y1, floorheinum) + floorz) / ZSCALE;
  const nextz1 = (nextslope(x1, y1, ceilnextheinum) + ceilnextz) / ZSCALE;
  const nextz2 = (nextslope(x2, y2, ceilnextheinum) + ceilnextz) / ZSCALE;
  const nextz3 = (nextslope(x2, y2, floornextheinum) + floornextz) / ZSCALE;
  const nextz4 = (nextslope(x1, y1, floornextheinum) + floornextz) / ZSCALE;
  const z1 = Math.min(currz1, nextz1);
  const z2 = Math.min(currz2, nextz2);
  const z3 = Math.max(currz3, nextz3);
  const z4 = Math.max(currz4, nextz4);
  return [x1, y1, z1, x2, y2, z2, x2, y2, z3, x1, y1, z4];
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
  const x1 = wall.x; const y1 = wall.y;
  const x2 = wall2.x; const y2 = wall2.y;
  const tex = art.get(wall.picnum);
  const info = art.getInfo(wall.picnum);
  const slope = createSlopeCalculator(board, sectorId);
  const ceilingheinum = sector.ceilingheinum;
  const ceilingz = sector.ceilingz;
  const floorheinum = sector.floorheinum;
  const floorz = sector.floorz;
  const trans = (wall.cstat.translucent || wall.cstat.translucentReversed) ? 0.6 : 1;
  const normal = normals(wallNormal(wallNormal_, board, wallId));

  if (wall.nextwall == -1 || wall.cstat.oneWay) {
    const coords = getWallCoords(x1, y1, x2, y2, slope, slope, ceilingheinum, floorheinum, ceilingz, floorz, false);
    const base = wall.cstat.alignBottom ? floorz : ceilingz;
    applyWallTextureTransform(wall, wall2, info, base, wall, texMat_);
    genQuad(coords, normal, texMat_, wall.pal, wall.shade, builder.mid.buff);
    builder.mid.tex = tex;
  } else {
    const nextsector = board.sectors[wall.nextsector];
    const nextslope = createSlopeCalculator(board, wall.nextsector);
    const nextfloorz = nextsector.floorz;
    const nextceilingz = nextsector.ceilingz;

    const nextfloorheinum = nextsector.floorheinum;
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
        const base = wall.cstat.alignBottom ? ceilingz : nextfloorz;
        applyWallTextureTransform(wall_, wall2_, info_, base, wall, texMat_);
        builder.bot.tex = tex_;
        shade = wall_.shade;
        pal = wall_.pal;
      }
      genQuad(floorcoords, normal, texMat_, pal, shade, builder.bot.buff);
    }

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
        applyWallTextureTransform(wall, wall2, info, base, wall, texMat_);
        builder.top.tex = tex;
        shade = wall.shade;
        pal = wall.pal;
      }
      genQuad(ceilcoords, normal, texMat_, pal, shade, builder.top.buff);
    }

    if (wall.cstat.masking) {
      const tex1 = art.get(wall.overpicnum);
      const info1 = art.getInfo(wall.overpicnum);
      const coords = getMaskedWallCoords(x1, y1, x2, y2, slope, nextslope,
        ceilingheinum, nextceilingheinum, ceilingz, nextceilingz,
        floorheinum, nextfloorheinum, floorz, nextfloorz);
      const base = wall.cstat.alignBottom ? Math.min(floorz, nextfloorz) : Math.max(ceilingz, nextceilingz);
      applyWallTextureTransform(wall, wall2, info1, base, wall, texMat_);
      genQuad(coords, normal, texMat_, wall.pal, wall.shade, builder.mid.buff);
      builder.mid.tex = tex1;
      builder.mid.trans = trans;
    }
  }

  return builder;
}