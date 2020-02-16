import { BuildContext } from "../../api";
import { Board, Sector } from "../../structs";
import { createSlopeCalculator, sectorOfWall, ZSCALE } from "../../utils";
import { BuildBuffer } from "../buffers";
import { buildCeilingHinge, buildFloorHinge, gridMatrixProviderSector } from "./common";
import { BuildRenderableProvider, GridBuilder, PointSpriteBuilder, Renderables, SectorRenderable, SolidBuilder, WireframeBuilder, LayeredRenderables } from "./renderable";
import { Builders } from "./api";
import { fastIterator } from "../../../../collections";

export class SectorHelperBuilder extends Builders implements SectorRenderable {
  constructor(
    readonly ceilpoints = new PointSpriteBuilder(),
    readonly ceilwire = new WireframeBuilder(),
    readonly ceilhinge = new WireframeBuilder(),
    readonly ceilgrid = new GridBuilder(),
    readonly floorpoints = new PointSpriteBuilder(),
    readonly floorwire = new WireframeBuilder(),
    readonly floorhinge = new WireframeBuilder(),
    readonly floorgrid = new GridBuilder(),
    readonly ceiling = new LayeredRenderables(fastIterator([ceilpoints, ceilwire, ceilhinge, ceilgrid])),
    readonly floor = new LayeredRenderables(fastIterator([floorpoints, floorwire, floorhinge, floorgrid])),
  ) { super(fastIterator([ceilpoints, ceilwire, ceilhinge, ceilgrid, floorpoints, floorwire, floorhinge, floorgrid])) }
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

function fillBuffersForSectorWireframe(s: number, sec: Sector, heinum: number, z: number, board: Board, builder: WireframeBuilder) {
  let slope = createSlopeCalculator(board, s);
  const buff = builder.buff;
  buff.allocate(sec.wallnum, sec.wallnum * 2);

  let fw = sec.wallptr;
  let off = 0;
  for (let w = 0; w < sec.wallnum; w++) {
    let wid = sec.wallptr + w;
    let wall = board.walls[wid];
    let vx = wall.x;
    let vy = wall.y;
    let vz = (slope(vx, vy, heinum) + z) / ZSCALE;
    buff.writePos(w, vx, vz, vy);
    if (fw != wid) {
      off = buff.writeLine(off, w - 1, w);
    }
    if (wall.point2 == fw) {
      off = buff.writeLine(off, w, fw - sec.wallptr);
      fw = wid + 1;
    }
  }
}

export function updateSectorHelper(cache: BuildRenderableProvider, ctx: BuildContext, secId: number, builder: SectorHelperBuilder): SectorHelperBuilder {
  builder = builder == null ? new SectorHelperBuilder() : builder;
  const pointTex = ctx.art.get(-1);
  builder.ceilpoints.tex = pointTex;
  builder.floorpoints.tex = pointTex;

  const sec = ctx.board.sectors[secId];
  const wallnum = sec.wallnum;
  builder.ceilpoints.buff.allocate(wallnum * 4, wallnum * 6);
  builder.floorpoints.buff.allocate(wallnum * 4, wallnum * 6);
  for (let i = 0; i < wallnum; i++) {
    const w = sec.wallptr + i;
    addWallPoint(i, builder.ceilpoints, ctx, true, w, 2.5);
    addWallPoint(i, builder.floorpoints, ctx, false, w, 2.5);
  }

  fillBuffersForSectorWireframe(secId, sec, sec.ceilingheinum, sec.ceilingz, ctx.board, builder.ceilwire);
  fillBuffersForSectorWireframe(secId, sec, sec.floorheinum, sec.floorz, ctx.board, builder.floorwire);

  buildCeilingHinge(ctx, secId, builder.ceilhinge);
  buildFloorHinge(ctx, secId, builder.floorhinge);

  const sectorRenderable = cache.sector(secId);
  builder.ceilgrid.gridTexMatProvider = gridMatrixProviderSector;
  builder.ceilgrid.solid = <SolidBuilder>sectorRenderable.ceiling;

  builder.floorgrid.gridTexMatProvider = gridMatrixProviderSector;
  builder.floorgrid.solid = <SolidBuilder>sectorRenderable.floor;

  return builder;
}