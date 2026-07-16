import { mat2d, mat4, vec2, vec3, vec4 } from "gl-matrix";
import { Deck, groups, last, slidingPairs } from "ts-utils/collections";
import { iter } from "ts-utils/iter";
import { sectorWalls } from "../../../../../build/board/loops";
import { Board } from "../../../../../build/board/structs";
import { ArtInfo } from "../../../../../build/formats/art";
import { ANGSCALE, ZSCALE, convertVisibility, createSlopeCalculator, getFirstWallAngle, sectorNormal, triangulate } from "../../../../../build/utils";
import { Builders } from "../../../../apis/builder";
import { SectorRenderable } from "../../../../apis/renderable";
import { BuildBuffer } from "../../buffers";
import { RenderablesCacheContext } from "../cache";
import { BuildersFactory } from "../common";


export class SectorBuilder extends Builders implements SectorRenderable {
  constructor(
    factory: BuildersFactory,
    readonly ceiling = factory.solid('sector'),
    readonly floor = factory.solid('sector'),
    readonly tdceiling = factory.solid('sector'),
    readonly tdfloor = factory.solid('sector'),
  ) { super([ceiling, floor, tdceiling, tdfloor]) }
}

function applySectorTextureTransform(board: Board, sectorId: number, ceiling: boolean, info: ArtInfo, texMat: mat4) {
  const sector = board.sectors[sectorId];
  const xpan = (ceiling ? sector.ceilingxpanning : sector.floorxpanning) / 255;
  const ypan = (ceiling ? sector.ceilingypanning : sector.floorypanning) / 255;
  const stats = ceiling ? sector.ceilingstat : sector.floorstat;
  const heinum = (ceiling ? sector.ceilingheinum : sector.floorheinum) * ANGSCALE;
  const angscale = stats.alignToFirstWall ? Math.sqrt(1 + heinum * heinum) : 1;
  const scale = stats.doubleSmooshiness ? 8 : 16;
  const parallaxscale = stats.parallaxing ? 6 : 1;
  const tcscalex = (stats.xflip ? -1 : 1) / (info.w * scale * parallaxscale);
  const tcscaley = (stats.yflip ? -angscale : angscale) / (info.h * scale);
  mat4.identity(texMat);
  mat4.translate(texMat, texMat, [xpan, ypan, 0]);
  mat4.scale(texMat, texMat, [tcscalex, -tcscaley, 1]);
  if (stats.swapXY) {
    mat4.scale(texMat, texMat, [1, -1, 1]);
    mat4.rotateZ(texMat, texMat, Math.PI / 2);
  }
  if (stats.alignToFirstWall) {
    const w1 = board.walls[sector.wallptr];
    mat4.scale(texMat, texMat, [1, -1, 1]);
    mat4.rotateZ(texMat, texMat, getFirstWallAngle(board, sectorId));
    mat4.translate(texMat, texMat, [-w1.x, -w1.y, 0])
  }
  mat4.rotateX(texMat, texMat, -Math.PI / 2);
}

const tc_ = vec4.create();
const lm_ = vec2.create();
function fillBuffersForSectorNormal(ceil: boolean, board: Board, sectorId: number,
  heinum: number, shade: number, pal: number, z: number,
  buff: BuildBuffer,
  vtxs: number[][], vidxs: number[], normal: vec3, t: mat4, lms: mat2d) {
  const slope = createSlopeCalculator(board, sectorId);
  for (let i = 0; i < vtxs.length; i++) {
    const vx = vtxs[i][0];
    const vy = vtxs[i][1];
    const vz = (slope(vx, vy, heinum) + z) / ZSCALE;
    buff.writePos(i, vx, vz, vy);
    buff.writeNormal(i, normal[0], normal[1], normal[2]);
    vec4.transformMat4(tc_, vec4.set(tc_, vx, vz, vy, 1), t);
    buff.writeTcLighting(i, tc_[0], tc_[1], pal, shade);
    vec2.transformMat2d(lm_, vec2.set(lm_, vx, vy), lms);
    buff.writeLightmap(i, lm_[0], lm_[1], 0, 0);
  }

  iter(groups(vidxs, 3))
    .enumerate()
    .forEach(([[a, b, c], i]) => {
      if (ceil) buff.writeTriangle(i * 3, a, b, c);
      else buff.writeTriangle(i * 3, c, b, a)
    })
  // if (ceil) {
  //   for (let i = 0; i < vidxs.length; i += 3)
  //     buff.writeTriangle(i, vidxs[i + 0], vidxs[i + 1], vidxs[i + 2]);
  // } else {
  //   for (let i = 0; i < vidxs.length; i += 3)
  //     buff.writeTriangle(i, vidxs[i + 2], vidxs[i + 1], vidxs[i + 0]);
  // }
}

function compress(triangles: point2d[]): [point2d[], number[]] {
  const vtxidx = new Map<string, number>();
  const vtxset: [number, number][] = [];
  const indexes: number[] = [];
  iter(triangles).forEach(([x0, y0]) => {
    const vtx0 = `${x0},${y0}`;
    let idx = vtxidx.get(vtx0);
    if (idx === undefined) {
      idx = vtxset.length;
      vtxidx.set(vtx0, idx);
      vtxset.push([x0, y0]);
    }
    indexes.push(idx);
  });
  return [vtxset, indexes];
}

function fillBuffersForSector(ceil: boolean, board: Board, s: number, builder: SectorBuilder, normal: vec3, t: mat4, lms: mat2d) {
  const [vtxs, vidxs] = triangulate(board, s);
  const d = ceil ? builder.ceiling : builder.floor;
  d.buff.allocate(vtxs.length, vidxs.length);
  const sector = board.sectors[s];
  const heinum = ceil ? (sector.ceilingstat.slopped ? sector.ceilingheinum : 0) : (sector.floorstat.slopped ? sector.floorheinum : 0);
  const shade = ceil ? sector.ceilingshade : sector.floorshade;
  const pal = ceil ? sector.ceilingpal : sector.floorpal;
  const z = ceil ? sector.ceilingz : sector.floorz;
  fillBuffersForSectorNormal(ceil, board, s, heinum, shade, pal, z, d.buff, vtxs, vidxs, normal, t, lms);
}

const normal = vec3.create();
const texMat = mat4.create();
const dummyLm = mat2d.create();
export function updateSector(ctx: RenderablesCacheContext, sectorId: number, builder: SectorBuilder): SectorBuilder {
  builder = builder == null ? new SectorBuilder(ctx.factory) : builder;
  const board = ctx.board();
  const art = ctx.textures.art.get();
  const sector = board.sectors[sectorId];

  const ceilinginfo = art.get(sector.ceilingpicnum);
  const ceilinglms = dummyLm;
  applySectorTextureTransform(board, sectorId, true, ceilinginfo, texMat);
  fillBuffersForSector(true, board, sectorId, builder, sectorNormal(normal, board, sectorId, true), texMat, ceilinglms);
  builder.ceiling.tex = sector.ceilingstat.parallaxing
    ? ctx.textures.getParallaxTexture(ctx.ctx.parallaxPicnums(sector.ceilingpicnum)).get()
    : ctx.textures.get(sector.ceilingpicnum).get();
  builder.ceiling.parallax = sector.ceilingstat.parallaxing;
  builder.ceiling.vis = convertVisibility(sector.visibility);

  const floorinfo = art.get(sector.floorpicnum);
  const floorlms = dummyLm;
  applySectorTextureTransform(board, sectorId, false, floorinfo, texMat);
  fillBuffersForSector(false, board, sectorId, builder, sectorNormal(normal, board, sectorId, false), texMat, floorlms);
  builder.floor.tex = sector.floorstat.parallaxing
    ? ctx.textures.getParallaxTexture(ctx.ctx.parallaxPicnums(sector.floorpicnum)).get()
    : ctx.textures.get(sector.floorpicnum).get();
  builder.floor.parallax = sector.floorstat.parallaxing;
  builder.floor.vis = convertVisibility(sector.visibility);

  // if (sector.lotag == 32 && isValidSectorId(board, sector.hitag)) {
  //   const tds = board.sectors[sector.hitag];
  //   const [vtxs, vidxs] = triangulate(board, sectorId);

  //   const tdceilingInfo = art.getInfo(tds.ceilingpicnum);
  //   applySectorTextureTransform(board, sector.hitag, false, tdceilingInfo, texMat_);
  //   builder.tdceiling.buff.allocate(vtxs.length, vidxs.length);
  //   fillBuffersForSectorNormal(false, board, sectorId,
  //     tds.ceilingheinum, tds.ceilingshade, tds.ceilingpal, tds.ceilingz,
  //     builder.tdceiling.buff, vtxs, vidxs, sectorNormal(sectorNormal_, board, sectorId, false), texMat_);
  //   builder.tdceiling.tex = tds.ceilingstat.parallaxing ? art.getParallaxTexture(tds.ceilingpicnum) : art.get(tds.ceilingpicnum);
  //   builder.tdceiling.parallax = tds.ceilingstat.parallaxing;

  //   const tdfloorInfo = art.getInfo(tds.floorpicnum);
  //   applySectorTextureTransform(board, sector.hitag, true, tdfloorInfo, texMat_);
  //   builder.tdfloor.buff.allocate(vtxs.length, vidxs.length);
  //   fillBuffersForSectorNormal(true, board, sectorId,
  //     tds.floorheinum, tds.floorshade, tds.floorpal, tds.floorz,
  //     builder.tdfloor.buff, vtxs, vidxs, sectorNormal(sectorNormal_, board, sectorId, true), texMat_);
  //   builder.tdfloor.tex = tds.floorstat.parallaxing ? art.getParallaxTexture(tds.floorpicnum) : art.get(tds.floorpicnum);
  //   builder.tdfloor.parallax = tds.floorstat.parallaxing;
  // }

  return builder;
}