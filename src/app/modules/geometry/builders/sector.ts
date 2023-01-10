import { isValidSectorId } from "../../../../build/board/query";
import { sectorWalls } from "../../../../build/board/loops";
import { Board, Wall } from "../../../../build/board/structs";
import { ArtInfo } from "../../../../build/formats/art";
import { createSlopeCalculator, getFirstWallAngle, sectorNormal, ZSCALE } from "../../../../build/utils";
import { mat4, Mat4Array, vec3, Vec3Array, vec4 } from "../../../../libs_js/glmatrix";
import { Deck, last, range } from "../../../../utils/collections";
import { iter } from "../../../../utils/iter";
import { Builders } from "../../../apis/builder";
import { SectorRenderable } from "../../../apis/renderable";
import { BuildBuffer } from "../../gl/buffers";
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

function applySectorTextureTransform(board: Board, sectorId: number, ceiling: boolean, info: ArtInfo, texMat: Mat4Array) {
  const sector = board.sectors[sectorId];
  const xpan = (ceiling ? sector.ceilingxpanning : sector.floorxpanning) / 256.0;
  const ypan = (ceiling ? sector.ceilingypanning : sector.floorypanning) / 256.0;
  const stats = ceiling ? sector.ceilingstat : sector.floorstat;
  const scale = stats.doubleSmooshiness ? 8.0 : 16.0;
  const parallaxscale = stats.parallaxing ? 6.0 : 1.0;
  const tcscalex = (stats.xflip ? -1.0 : 1.0) / (info.w * scale * parallaxscale);
  const tcscaley = (stats.yflip ? -1.0 : 1.0) / (info.h * scale);
  mat4.identity(texMat);
  mat4.translate(texMat, texMat, [xpan, ypan, 0, 0]);
  mat4.scale(texMat, texMat, [tcscalex, -tcscaley, 1, 1]);
  if (stats.swapXY) {
    mat4.scale(texMat, texMat, [-1, -1, 1, 1]);
    mat4.rotateZ(texMat, texMat, Math.PI / 2);
  }
  if (stats.alignToFirstWall) {
    const w1 = board.walls[sector.wallptr];
    mat4.rotateZ(texMat, texMat, getFirstWallAngle(board, sectorId));
    mat4.translate(texMat, texMat, [-w1.x, -w1.y, 0, 0])
  }
  mat4.rotateX(texMat, texMat, -Math.PI / 2);
}

const tc_ = vec4.create();
function fillBuffersForSectorNormal(ceil: boolean, board: Board, sectorId: number,
  heinum: number, shade: number, pal: number, z: number,
  buff: BuildBuffer,
  vtxs: number[][], vidxs: number[], normal: Vec3Array, t: Mat4Array) {
  const slope = createSlopeCalculator(board, sectorId);

  for (let i = 0; i < vtxs.length; i++) {
    const vx = vtxs[i][0];
    const vy = vtxs[i][1];
    const vz = (slope(vx, vy, heinum) + z) / ZSCALE;
    buff.writePos(i, vx, vz, vy);
    buff.writeNormal(i, normal[0], normal[1], normal[2]);
    vec4.transformMat4(tc_, vec4.set(tc_, vx, vz, vy, 1), t);
    buff.writeTcLighting(i, tc_[0], tc_[1], pal, shade);
  }

  if (ceil) {
    for (let i = 0; i < vidxs.length; i += 3)
      buff.writeTriangle(i, vidxs[i + 0], vidxs[i + 1], vidxs[i + 2]);
  } else {
    for (let i = 0; i < vidxs.length; i += 3)
      buff.writeTriangle(i, vidxs[i + 2], vidxs[i + 1], vidxs[i + 0]);
  }
}

function compress(triangles: point2d[]): [point2d[], number[]] {
  const vtxidx: string[] = [];
  const vtxset: [number, number][] = [];
  const indexes: number[] = [];
  iter(triangles).forEach(([x0, y0]) => {
    const vtx0 = `${x0},${y0}`;
    let idx = vtxidx.indexOf(vtx0);
    if (idx == -1) {
      idx = vtxset.length;
      vtxidx.push(vtx0);
      vtxset.push([x0, y0]);
    }
    indexes.push(idx);
  });
  return [vtxset, indexes];
}

type point2d = [number, number];
type point2dxy = { x: number, y: number };
type zoid_t = { x: [number, number, number, number], y: [number, number], w: [Wall, Wall] };
type trap_t = { x0: number, x1: number, w: Wall }
const trapCmp = (lh: trap_t, rh: trap_t) => { return lh.x0 + lh.x1 - rh.x0 - rh.x1 }

export function triangulate(board: Board, sectorId: number) {
  const secy = [...new Set(iter(sectorWalls(board, sectorId))
    .map(w => board.walls[w].y)
    .collect()
    .sort((l, r) => l - r))];
  const zoids = new Deck<zoid_t>();
  for (const [sy0, sy1] of iter(range(0, secy.length - 1))
    .map(i => [secy[i], secy[i + 1]])) {
    const ts = new Deck<trap_t>();
    for (const [w0, w1] of iter(sectorWalls(board, sectorId))
      .map(w => [board.walls[w], board.walls[board.walls[w].point2]])) {
      let [x0, y0, x1, y1] = w0.y > w1.y ? [w1.x, w1.y, w0.x, w0.y] : [w0.x, w0.y, w1.x, w1.y];
      if ((y0 >= sy1) || (y1 <= sy0)) continue;
      if (y0 < sy0) x0 = (sy0 - w0.y) * (w1.x - w0.x) / (w1.y - w0.y) + w0.x;
      if (y1 > sy1) x1 = (sy1 - w0.y) * (w1.x - w0.x) / (w1.y - w0.y) + w0.x;
      ts.push({ x0, x1, w: w0 });
    }
    const traps = [...ts].sort(trapCmp);
    let j = 0;
    for (let i = 0; i < traps.length; i = j + 1) {
      j = i + 1;
      const trapi = traps[i];
      const trapi1 = traps[i + 1];
      if ((trapi1.x0 <= trapi.x0) && (trapi1.x1 <= trapi.x1)) continue;
      while ((j + 2 < traps.length) && (traps[j + 1].x0 <= traps[j].x0) && (traps[j + 1].x1 <= traps[j].x1)) j += 2;
      const x0 = trapi.x0
      const x1 = traps[j].x0;
      const x2 = traps[j].x1;
      const x3 = trapi.x1;
      const y0 = sy0;
      const y1 = sy1;
      const w0 = trapi.w
      const w1 = traps[j].w;
      zoids.push({ x: [x0, x1, x2, x3], y: [y0, y1], w: [w0, w1] });
    }
  }

  const triangles: point2d[] = [];
  for (let i = 0; i < zoids.length(); i++) {
    const pol = new Deck<point2dxy>();
    for (let j = 0; j < 4; j++) {
      const polx = zoids.get(i).x[j];
      const poly = zoids.get(i).y[j >> 1];
      if (pol.length() == 0 || (polx != last(pol).x) || (poly != last(pol).y)) pol.push({ x: polx, y: poly });
    }
    if (pol.length() < 3) continue;
    const fp0x = pol.get(0).x;
    const fp0y = pol.get(0).y;
    for (let j = 2; j < pol.length(); j++) {
      const fp1x = pol.get(j).x;
      const fp1y = pol.get(j).y;
      const fp2x = pol.get(j - 1).x;
      const fp2y = pol.get(j - 1).y;
      triangles.push([fp2x, fp2y]);
      triangles.push([fp1x, fp1y]);
      triangles.push([fp0x, fp0y]);
    }
  }

  return compress(triangles);
}

function fillBuffersForSector(ceil: boolean, board: Board, s: number, builder: SectorBuilder, normal: Vec3Array, t: Mat4Array) {
  const [vtxs, vidxs] = triangulate(board, s);
  const d = ceil ? builder.ceiling : builder.floor;
  d.buff.allocate(vtxs.length, vidxs.length);
  const sector = board.sectors[s];
  const heinum = ceil ? sector.ceilingheinum : sector.floorheinum;
  const shade = ceil ? sector.ceilingshade : sector.floorshade;
  const pal = ceil ? sector.ceilingpal : sector.floorpal;
  const z = ceil ? sector.ceilingz : sector.floorz;
  fillBuffersForSectorNormal(ceil, board, s, heinum, shade, pal, z, d.buff, vtxs, vidxs, normal, t);
}

const sectorNormal_ = vec3.create();
const texMat_ = mat4.create();
export function updateSector(ctx: RenderablesCacheContext, sectorId: number, builder: SectorBuilder): SectorBuilder {
  builder = builder == null ? new SectorBuilder(ctx.factory) : builder;
  const board = ctx.board();
  const art = ctx.art;
  const sector = board.sectors[sectorId];

  const ceilinginfo = art.getInfo(sector.ceilingpicnum);
  applySectorTextureTransform(board, sectorId, true, ceilinginfo, texMat_);
  fillBuffersForSector(true, board, sectorId, builder, sectorNormal(sectorNormal_, board, sectorId, true), texMat_);
  builder.ceiling.tex = sector.ceilingstat.parallaxing ? art.getParallaxTexture(sector.ceilingpicnum) : art.get(sector.ceilingpicnum);
  builder.ceiling.parallax = sector.ceilingstat.parallaxing;

  const floorinfo = art.getInfo(sector.floorpicnum);
  applySectorTextureTransform(board, sectorId, false, floorinfo, texMat_);
  fillBuffersForSector(false, board, sectorId, builder, sectorNormal(sectorNormal_, board, sectorId, false), texMat_);
  builder.floor.tex = sector.floorstat.parallaxing ? art.getParallaxTexture(sector.floorpicnum) : art.get(sector.floorpicnum);
  builder.floor.parallax = sector.floorstat.parallaxing;

  if (sector.lotag == 32 && isValidSectorId(board, sector.hitag)) {
    const tds = board.sectors[sector.hitag];
    const [vtxs, vidxs] = triangulate(board, sectorId);

    const tdceilingInfo = art.getInfo(tds.ceilingpicnum);
    applySectorTextureTransform(board, sector.hitag, false, tdceilingInfo, texMat_);
    builder.tdceiling.buff.allocate(vtxs.length, vidxs.length);
    fillBuffersForSectorNormal(false, board, sectorId,
      tds.ceilingheinum, tds.ceilingshade, tds.ceilingpal, tds.ceilingz,
      builder.tdceiling.buff, vtxs, vidxs, sectorNormal(sectorNormal_, board, sectorId, false), texMat_);
    builder.tdceiling.tex = tds.ceilingstat.parallaxing ? art.getParallaxTexture(tds.ceilingpicnum) : art.get(tds.ceilingpicnum);
    builder.tdceiling.parallax = tds.ceilingstat.parallaxing;

    const tdfloorInfo = art.getInfo(tds.floorpicnum);
    applySectorTextureTransform(board, sector.hitag, true, tdfloorInfo, texMat_);
    builder.tdfloor.buff.allocate(vtxs.length, vidxs.length);
    fillBuffersForSectorNormal(true, board, sectorId,
      tds.floorheinum, tds.floorshade, tds.floorpal, tds.floorz,
      builder.tdfloor.buff, vtxs, vidxs, sectorNormal(sectorNormal_, board, sectorId, true), texMat_);
    builder.tdfloor.tex = tds.floorstat.parallaxing ? art.getParallaxTexture(tds.floorpicnum) : art.get(tds.floorpicnum);
    builder.tdfloor.parallax = tds.floorstat.parallaxing;
  }

  return builder;
}