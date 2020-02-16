import { int } from "../../../../../libs/mathutils";
import { BuildContext } from "../../api";
import { walllen } from "../../boardutils";
import { Board } from "../../structs";
import { createSlopeCalculator, sectorOfWall, slope, ZSCALE } from "../../utils";
import { BuildBuffer } from "../buffers";
import { createGridMatrixProviderWall, text } from "./common";
import { BuildRenderableProvider, GridBuilder, PointSpriteBuilder, Renderables, SolidBuilder, WallRenderable, WireframeBuilder, LayeredRenderables } from "./renderable";
import { Builders } from "./api";
import { fastIterator } from "../../../../collections";

export class WallHelperBuilder extends Builders implements WallRenderable {
  constructor(
    readonly topWire = new WireframeBuilder(),
    readonly topGrid = new GridBuilder(),
    readonly topPoints = new PointSpriteBuilder(),
    readonly topLength = new PointSpriteBuilder(),
    readonly midWire = new WireframeBuilder(),
    readonly midGrid = new GridBuilder(),
    readonly botWire = new WireframeBuilder(),
    readonly botGrid = new GridBuilder(),
    readonly botPoints = new PointSpriteBuilder(),
    readonly botLength = new PointSpriteBuilder(),
    readonly top = new LayeredRenderables(fastIterator([topWire, topGrid, topPoints, topLength])),
    readonly mid = new LayeredRenderables(fastIterator([midWire, midGrid])),
    readonly bot = new LayeredRenderables(fastIterator([botWire, botGrid, botPoints, botLength])),
  ) {
    super(fastIterator([topWire, midWire, topGrid, midGrid, botGrid, topPoints, botPoints, topLength, botLength]));
  }
}

function genQuadWireframe(coords: number[], normals: number[], buff: BuildBuffer) {
  buff.allocate(4, 8);
  let [x1, y1, z1, x2, y2, z2, x3, y3, z3, x4, y4, z4] = coords;
  buff.writePos(0, x1, z1, y1);
  buff.writePos(1, x2, z2, y2);
  buff.writePos(2, x3, z3, y3);
  buff.writePos(3, x4, z4, y4);
  if (normals != null) {
    buff.writeNormal(0, normals[0], normals[1], 0);
    buff.writeNormal(1, normals[2], normals[3], 0);
    buff.writeNormal(2, normals[4], normals[5], 0);
    buff.writeNormal(3, normals[6], normals[7], 0);
  }
  buff.writeLine(0, 0, 1);
  buff.writeLine(2, 1, 2);
  buff.writeLine(4, 2, 3);
  buff.writeLine(6, 3, 0);
}

function getWallCoords(x1: number, y1: number, x2: number, y2: number,
  slope: any, nextslope: any, heinum: number, nextheinum: number, z: number, nextz: number, check: boolean, line = false): number[] {
  let z1 = (slope(x1, y1, heinum) + z) / ZSCALE;
  let z2 = (slope(x2, y2, heinum) + z) / ZSCALE;
  let z3 = (nextslope(x2, y2, nextheinum) + nextz) / ZSCALE;
  let z4 = (nextslope(x1, y1, nextheinum) + nextz) / ZSCALE;
  if (check) {
    if (line && z4 > z1 && z3 > z2) return null;
    if (!line && z4 >= z1 && z3 >= z2) return null;
  }
  return [x1, y1, z1, x2, y2, z2, x2, y2, z3, x1, y1, z4];
}

function getMaskedWallCoords(x1: number, y1: number, x2: number, y2: number, slope: any, nextslope: any,
  ceilheinum: number, ceilnextheinum: number, ceilz: number, ceilnextz: number,
  floorheinum: number, floornextheinum: number, floorz: number, floornextz: number): number[] {
  let currz1 = (slope(x1, y1, ceilheinum) + ceilz) / ZSCALE;
  let currz2 = (slope(x2, y2, ceilheinum) + ceilz) / ZSCALE;
  let currz3 = (slope(x2, y2, floorheinum) + floorz) / ZSCALE;
  let currz4 = (slope(x1, y1, floorheinum) + floorz) / ZSCALE;
  let nextz1 = (nextslope(x1, y1, ceilnextheinum) + ceilnextz) / ZSCALE;
  let nextz2 = (nextslope(x2, y2, ceilnextheinum) + ceilnextz) / ZSCALE;
  let nextz3 = (nextslope(x2, y2, floornextheinum) + floornextz) / ZSCALE;
  let nextz4 = (nextslope(x1, y1, floornextheinum) + floornextz) / ZSCALE;
  let z1 = Math.min(currz1, nextz1);
  let z2 = Math.min(currz2, nextz2);
  let z3 = Math.max(currz3, nextz3);
  let z4 = Math.max(currz4, nextz4);
  return [x1, y1, z1, x2, y2, z2, x2, y2, z3, x1, y1, z4];
}

export function updateWallWireframe(ctx: BuildContext, wallId: number, builder: WallHelperBuilder): WallHelperBuilder {
  const board = ctx.board;
  const wall = board.walls[wallId];
  const sectorId = sectorOfWall(board, wallId)
  const sector = board.sectors[sectorId];
  const wall2 = board.walls[wall.point2];
  const x1 = wall.x; const y1 = wall.y;
  const x2 = wall2.x; const y2 = wall2.y;
  const slope = createSlopeCalculator(board, sectorId);
  const ceilingheinum = sector.ceilingheinum;
  const ceilingz = sector.ceilingz;
  const floorheinum = sector.floorheinum;
  const floorz = sector.floorz;

  if (wall.nextwall == -1 || wall.cstat.oneWay) {
    const coords = getWallCoords(x1, y1, x2, y2, slope, slope, ceilingheinum, floorheinum, ceilingz, floorz, false);
    genQuadWireframe(coords, null, builder.midWire.buff);
  } else {
    const nextsector = board.sectors[wall.nextsector];
    const nextslope = createSlopeCalculator(board, wall.nextsector);
    const nextfloorz = nextsector.floorz;
    const nextceilingz = nextsector.ceilingz;

    const nextfloorheinum = nextsector.floorheinum;
    const botcoords = getWallCoords(x1, y1, x2, y2, nextslope, slope, nextfloorheinum, floorheinum, nextfloorz, floorz, true, true);
    if (botcoords != null) genQuadWireframe(botcoords, null, builder.botWire.buff);

    const nextceilingheinum = nextsector.ceilingheinum;
    const topcoords = getWallCoords(x1, y1, x2, y2, slope, nextslope, ceilingheinum, nextceilingheinum, ceilingz, nextceilingz, true, true);
    if (topcoords != null) genQuadWireframe(topcoords, null, builder.topWire.buff);

    if (wall.cstat.masking) {
      const coords = getMaskedWallCoords(x1, y1, x2, y2, slope, nextslope,
        ceilingheinum, nextceilingheinum, ceilingz, nextceilingz,
        floorheinum, nextfloorheinum, floorz, nextfloorz);
      genQuadWireframe(coords, null, builder.midWire.buff);
    }
  }
  return builder;
}

function fillBufferForWallPoint(offset: number, board: Board, wallId: number, buff: BuildBuffer, d: number, z: number) {
  const wall = board.walls[wallId];
  const vtxOff = offset * 4;
  buff.writePos(vtxOff + 0, wall.x, z, wall.y);
  buff.writePos(vtxOff + 1, wall.x, z, wall.y);
  buff.writePos(vtxOff + 2, wall.x, z, wall.y);
  buff.writePos(vtxOff + 3, wall.x, z, wall.y);
  buff.writeNormal(vtxOff + 0, -d, d, 0);
  buff.writeNormal(vtxOff + 1, d, d, 0);
  buff.writeNormal(vtxOff + 2, d, -d, 0);
  buff.writeNormal(vtxOff + 3, -d, -d, 0);
  buff.writeTc(vtxOff + 0, 0, 0);
  buff.writeTc(vtxOff + 1, 1, 0);
  buff.writeTc(vtxOff + 2, 1, 1);
  buff.writeTc(vtxOff + 3, 0, 1);
  buff.writeQuad(offset * 6, vtxOff, vtxOff + 1, vtxOff + 2, vtxOff + 3);
}

function updateWallPoint(offset: number, builder: PointSpriteBuilder, ctx: BuildContext, ceiling: boolean, wallId: number, d: number): void {
  const board = ctx.board;
  const s = sectorOfWall(board, wallId);
  const sec = board.sectors[s];
  const slope = createSlopeCalculator(board, s);
  const h = (ceiling ? sec.ceilingheinum : sec.floorheinum);
  const z = (ceiling ? sec.ceilingz : sec.floorz);
  const wall = board.walls[wallId];
  const zz = (slope(wall.x, wall.y, h) + z) / ZSCALE;
  fillBufferForWallPoint(offset, board, wallId, builder.buff, d, zz);
}

function addWallPoints(ctx: BuildContext, builder: PointSpriteBuilder, wallId: number, ceiling: boolean): void {
  const pointTex = ctx.art.get(-1);
  builder.tex = pointTex;
  builder.buff.allocate(8, 12);
  updateWallPoint(0, builder, ctx, ceiling, wallId, 2.5);
  const wallId2 = ctx.board.walls[wallId].point2;
  updateWallPoint(1, builder, ctx, ceiling, wallId2, 2.5);
}

function addLength(ctx: BuildContext, builder: PointSpriteBuilder, wallId: number, ceiling: boolean) {
  const wallId2 = ctx.board.walls[wallId].point2;
  const wall = ctx.board.walls[wallId];
  const wall2 = ctx.board.walls[wallId2];
  const cx = int(wall.x + (wall2.x - wall.x) * 0.5);
  const cy = int(wall.y + (wall2.y - wall.y) * 0.5);
  const sectorId = sectorOfWall(ctx.board, wallId);
  const sector = ctx.board.sectors[sectorId];
  const fz = slope(ctx.board, sectorId, cx, cy, sector.floorheinum) + sector.floorz;
  const cz = slope(ctx.board, sectorId, cx, cy, sector.ceilingheinum) + sector.ceilingz;
  const length = walllen(ctx.board, wallId).toFixed(2).replace(/\.00$/, "");
  text(builder, length, cx, cy, (ceiling ? cz : fz) / ZSCALE, 8, 8, ctx.art.get(-2));
}

export function updateWallHelper(cache: BuildRenderableProvider, ctx: BuildContext, wallId: number, builder: WallHelperBuilder): WallHelperBuilder {
  builder = builder == null ? new WallHelperBuilder() : builder;

  updateWallWireframe(ctx, wallId, builder);
  const wallRenderable = cache.wall(wallId);
  const gridMatrix = createGridMatrixProviderWall(ctx.board, wallId);

  builder.topGrid.gridTexMatProvider = gridMatrix;
  builder.topGrid.solid = <SolidBuilder>wallRenderable.top;
  addWallPoints(ctx, builder.topPoints, wallId, true);
  addLength(ctx, builder.topLength, wallId, true);

  builder.midGrid.gridTexMatProvider = gridMatrix;
  builder.midGrid.solid = <SolidBuilder>wallRenderable.mid;

  builder.botGrid.gridTexMatProvider = gridMatrix;
  builder.botGrid.solid = <SolidBuilder>wallRenderable.bot;
  addWallPoints(ctx, builder.botPoints, wallId, false);
  addLength(ctx, builder.botLength, wallId, false);

  return builder;
}