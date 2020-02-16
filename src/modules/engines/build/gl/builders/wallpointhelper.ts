import { BuildContext } from "../../api";
import { createSlopeCalculator, sectorOfWall, slope, ZSCALE } from "../../utils";
import { PointSpriteBuilder, WireframeBuilder } from "./renderable";
import { Builders } from "./api";
import { Board } from "../../structs";
import { BuildBuffer } from "../buffers";
import { fastIterator } from "../../../../collections";

export class WallPointHelperBuilder extends Builders {
  constructor(
    readonly points = new PointSpriteBuilder(),
    readonly line = new WireframeBuilder()
  ) { super(fastIterator([points, line])) }
}

function updateWallLine(ctx: BuildContext, wallId: number, builder: WireframeBuilder): WireframeBuilder {
  const board = ctx.board;
  const buff = builder.buff;
  buff.allocate(2, 2);
  const sectorId = sectorOfWall(board, wallId);
  const sector = board.sectors[sectorId];
  const wall = board.walls[wallId];
  const fz = sector.floorz + slope(board, sectorId, wall.x, wall.y, sector.floorheinum);
  const cz = sector.ceilingz + slope(board, sectorId, wall.x, wall.y, sector.ceilingheinum);
  buff.writePos(0, wall.x, fz / ZSCALE, wall.y);
  buff.writePos(1, wall.x, cz / ZSCALE, wall.y);
  buff.writeLine(0, 0, 1);
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

function addWallPoint(offset: number, builder: PointSpriteBuilder, ctx: BuildContext, ceiling: boolean, wallId: number, d: number): void {
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

export function updateWallPoint(ctx: BuildContext, wallId: number, builder: WallPointHelperBuilder): WallPointHelperBuilder {
  builder = builder == null ? new WallPointHelperBuilder() : builder;
  builder.points.tex = ctx.art.get(-1);
  builder.points.buff.allocate(8, 12);
  addWallPoint(0, builder.points, ctx, true, wallId, 2.5);
  addWallPoint(1, builder.points, ctx, false, wallId, 2.5);
  updateWallLine(ctx, wallId, builder.line);
  return builder;
}