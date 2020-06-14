import { Board, Sector, Wall } from "../../../../build/board/structs";
import { ArtInfo } from "../../../../build/formats/art";
import { createSlopeCalculator, getFirstWallAngle, sectorNormal, sectorWalls, ZSCALE } from "../../../../build/utils";
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
    readonly floor = factory.solid('sector')
  ) { super([ceiling, floor]) }
}

function applySectorTextureTransform(sector: Sector, ceiling: boolean, walls: Wall[], info: ArtInfo, texMat: Mat4Array) {
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
    const w1 = walls[sector.wallptr];
    mat4.rotateZ(texMat, texMat, getFirstWallAngle(sector, walls));
    mat4.translate(texMat, texMat, [-w1.x, -w1.y, 0, 0])
  }
  mat4.rotateX(texMat, texMat, -Math.PI / 2);
}

const tc_ = vec4.create();
function fillBuffersForSectorNormal(ceil: boolean, board: Board, s: number, sec: Sector, buff: BuildBuffer, vtxs: number[][], vidxs: number[], normal: Vec3Array, t: Mat4Array) {
  const heinum = ceil ? sec.ceilingheinum : sec.floorheinum;
  const shade = ceil ? sec.ceilingshade : sec.floorshade;
  const pal = ceil ? sec.ceilingpal : sec.floorpal;
  const z = ceil ? sec.ceilingz : sec.floorz;
  const slope = createSlopeCalculator(board, s);

  for (let i = 0; i < vtxs.length; i++) {
    const vx = vtxs[i][0];
    const vy = vtxs[i][1];
    const vz = (slope(vx, vy, heinum) + z) / ZSCALE;
    buff.writePos(i, vx, vz, vy);
    buff.writeNormal(i, normal[0], normal[1], normal[2]);
    vec4.transformMat4(tc_, vec4.set(tc_, vx, vz, vy, 1), t);
    buff.writeTcLighting(i, tc_[0], tc_[1], pal, shade);
  }

  for (let i = 0; i < vidxs.length; i += 3) {
    if (ceil) {
      buff.writeTriangle(i, vidxs[i + 0], vidxs[i + 1], vidxs[i + 2]);
    } else {
      buff.writeTriangle(i, vidxs[i + 2], vidxs[i + 1], vidxs[i + 0]);
    }
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

export function triangulate(sector: Sector, walls: Wall[]) {
  const triangles: point2d[] = [];
  const secy = [...new Set(iter(sectorWalls(sector))
    .map(w => walls[w].y)
    .collect()
    .sort((l, r) => l - r))];
  const zoids = new Deck<zoid_t>();
  for (const [sy0, sy1] of iter(range(0, secy.length - 1))
    .map(i => [secy[i], secy[i + 1]])) {
    const ts = new Deck<trap_t>();
    for (const [w0, w1] of iter(sectorWalls(sector))
      .map(w => [walls[w], walls[walls[w].point2]])) {
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

function fillBuffersForSector(ceil: boolean, board: Board, s: number, sec: Sector, builder: SectorBuilder, normal: Vec3Array, t: Mat4Array) {
  const [vtxs, vidxs] = triangulate(sec, board.walls);
  const d = ceil ? builder.ceiling : builder.floor;
  d.buff.allocate(vtxs.length, vidxs.length);
  fillBuffersForSectorNormal(ceil, board, s, sec, d.buff, vtxs, vidxs, normal, t);
}

const sectorNormal_ = vec3.create();
const texMat_ = mat4.create();
export function updateSector(ctx: RenderablesCacheContext, secId: number, builder: SectorBuilder): SectorBuilder {
  builder = builder == null ? new SectorBuilder(ctx.factory) : builder;
  const board = ctx.board();
  const art = ctx.art;
  const sec = board.sectors[secId];

  const ceilinginfo = art.getInfo(sec.ceilingpicnum);
  applySectorTextureTransform(sec, true, board.walls, ceilinginfo, texMat_);
  fillBuffersForSector(true, board, secId, sec, builder, sectorNormal(sectorNormal_, board, secId, true), texMat_);
  builder.ceiling.tex = sec.ceilingstat.parallaxing ? art.getParallaxTexture(sec.ceilingpicnum) : art.get(sec.ceilingpicnum);
  builder.ceiling.parallax = sec.ceilingstat.parallaxing;

  const floorinfo = art.getInfo(sec.floorpicnum);
  applySectorTextureTransform(sec, false, board.walls, floorinfo, texMat_);
  fillBuffersForSector(false, board, secId, sec, builder, sectorNormal(sectorNormal_, board, secId, false), texMat_);
  builder.floor.tex = sec.floorstat.parallaxing ? art.getParallaxTexture(sec.floorpicnum) : art.get(sec.floorpicnum);
  builder.floor.parallax = sec.floorstat.parallaxing;

  return builder;
}