import { Board } from "../../../../build/board/structs";
import { createSlopeCalculator, slope, ZSCALE } from "../../../../build/utils";
import { int } from "../../../../utils/mathutils";
import { Builders } from "../../../apis/builder";
import { BuildRenderableProvider, WallRenderable, Renderables } from "../../../apis/renderable";
import { BuildBuffer } from "../../gl/buffers";
import { RenderablesCacheContext } from "../cache";
import { BuildersFactory, PointSpriteBuilder, SolidBuilder } from "../common";
import { text, createGridWallMatrix, WallGridType } from "./common";
import { vec4, mat4 } from "gl-matrix";
import { sectorOfWall, walllen } from "../../../../build/board/query";

export class WallHelperBuilder extends Builders implements WallRenderable {
  constructor(
    factory: BuildersFactory,
    readonly topWire = factory.wireframe('helper'),
    readonly topGrid = factory.grid('helper'),
    readonly topPoints = factory.pointSprite('helper'),
    readonly topLength = factory.pointSprite('helper'),
    readonly midWire = factory.wireframe('helper'),
    readonly midGrid = factory.grid('helper'),
    readonly botWire = factory.wireframe('helper'),
    readonly botGrid = factory.grid('helper'),
    readonly botPoints = factory.pointSprite('helper'),
    readonly botLength = factory.pointSprite('helper'),
    readonly top = new Renderables([topWire, topGrid, topPoints, topLength]),
    readonly mid = new Renderables([midWire, midGrid]),
    readonly bot = new Renderables([botWire, botGrid, botPoints, botLength]),
  ) {
    super([topWire, midWire, botWire, topGrid, midGrid, botGrid, topPoints, botPoints, topLength, botLength]);
  }
}

function genQuadWireframe(coords: number[], normals: number[], buff: BuildBuffer) {
  buff.allocate(4, 8);
  const [x1, y1, z1, x2, y2, z2, x3, y3, z3, x4, y4, z4] = coords;
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
  const z1 = (slope(x1, y1, heinum) + z) / ZSCALE;
  const z2 = (slope(x2, y2, heinum) + z) / ZSCALE;
  const z3 = (nextslope(x2, y2, nextheinum) + nextz) / ZSCALE;
  const z4 = (nextslope(x1, y1, nextheinum) + nextz) / ZSCALE;
  if (check) {
    if (line && z4 > z1 && z3 > z2) return null;
    if (!line && z4 >= z1 && z3 >= z2) return null;
  }
  return [x1, y1, z1, x2, y2, z2, x2, y2, z3, x1, y1, z4];
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

export function updateWallWireframe(ctx: RenderablesCacheContext, wallId: number, builder: WallHelperBuilder): WallHelperBuilder {
  const board = ctx.board();
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
  vec4.set(builder.topWire.color, 1, 1, 1, -100);
  vec4.set(builder.midWire.color, 1, 1, 1, -100);
  vec4.set(builder.botWire.color, 1, 1, 1, -100);

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
  buff.writeTcLighting(vtxOff + 0, 0, 0);
  buff.writeTcLighting(vtxOff + 1, 1, 0);
  buff.writeTcLighting(vtxOff + 2, 1, 1);
  buff.writeTcLighting(vtxOff + 3, 0, 1);
  buff.writeQuad(offset * 6, vtxOff, vtxOff + 1, vtxOff + 2, vtxOff + 3);
}

function updateWallPoint(offset: number, builder: PointSpriteBuilder, ctx: RenderablesCacheContext, ceiling: boolean, wallId: number, d: number): void {
  const board = ctx.board();
  const s = sectorOfWall(board, wallId);
  const sec = board.sectors[s];
  const slope = createSlopeCalculator(board, s);
  const h = (ceiling ? sec.ceilingheinum : sec.floorheinum);
  const z = (ceiling ? sec.ceilingz : sec.floorz);
  const wall = board.walls[wallId];
  const zz = (slope(wall.x, wall.y, h) + z) / ZSCALE;
  fillBufferForWallPoint(offset, board, wallId, builder.buff, d, zz);
}

function addWallPoints(ctx: RenderablesCacheContext, builder: PointSpriteBuilder, wallId: number, ceiling: boolean): void {
  const pointTex = ctx.art.get(-1);
  const board = ctx.board();
  builder.tex = pointTex;
  builder.buff.allocate(8, 12);
  updateWallPoint(0, builder, ctx, ceiling, wallId, 2.5);
  const wallId2 = board.walls[wallId].point2;
  updateWallPoint(1, builder, ctx, ceiling, wallId2, 2.5);
}

function addLength(ctx: RenderablesCacheContext, builder: PointSpriteBuilder, wallId: number, ceiling: boolean) {
  const board = ctx.board();
  const wallId2 = board.walls[wallId].point2;
  const wall = board.walls[wallId];
  const wall2 = board.walls[wallId2];
  const cx = int(wall.x + (wall2.x - wall.x) * 0.5);
  const cy = int(wall.y + (wall2.y - wall.y) * 0.5);
  const sectorId = sectorOfWall(board, wallId);
  const sector = board.sectors[sectorId];
  const fz = slope(board, sectorId, cx, cy, sector.floorheinum) + sector.floorz;
  const cz = slope(board, sectorId, cx, cy, sector.ceilingheinum) + sector.ceilingz;
  const length = walllen(board, wallId).toFixed(2).replace(/\.00$/, "");
  const z = (ceiling ? cz : fz) / ZSCALE;
  text(builder, length, cx, cy, z, 8, 8, ctx.art.get(-2));
}

export function updateWallHelper(cache: BuildRenderableProvider, ctx: RenderablesCacheContext, wallId: number, builder: WallHelperBuilder): WallHelperBuilder {
  builder = builder == null ? new WallHelperBuilder(ctx.factory) : builder;

  updateWallWireframe(ctx, wallId, builder);
  const wallRenderable = cache.wall(wallId);
  const board = ctx.board();
  const wall = board.walls[wallId];

  mat4.copy(builder.topGrid.gridTexMat, createGridWallMatrix(board, wallId, WallGridType.TOP));
  builder.topGrid.solid = <SolidBuilder>wallRenderable.top;
  addWallPoints(ctx, builder.topPoints, wallId, true);
  addLength(ctx, builder.topLength, wallId, true);

  mat4.copy(builder.midGrid.gridTexMat, createGridWallMatrix(board, wallId, wall.nextsector == -1 ? WallGridType.VOID : WallGridType.MID));
  builder.midGrid.solid = <SolidBuilder>wallRenderable.mid;

  mat4.copy(builder.botGrid.gridTexMat, createGridWallMatrix(board, wallId, WallGridType.BOT));
  builder.botGrid.solid = <SolidBuilder>wallRenderable.bot;
  addWallPoints(ctx, builder.botPoints, wallId, false);
  addLength(ctx, builder.botLength, wallId, false);

  return builder;
}