import { Board, Sector } from "../../../../build/board/structs";
import { createSlopeCalculator, ZSCALE } from "../../../../build/utils";
import { Builders } from "../../../apis/builder";
import { BuildRenderableProvider, SectorRenderable, HELPER_GRID, Renderables } from "../../../apis/renderable";
import { BuildBuffer } from "../../gl/buffers";
import { RenderablesCacheContext } from "../cache";
import { BuildersFactory, PointSpriteBuilder, SolidBuilder, WireframeBuilder } from "../common";
import { buildCeilingHinge, buildFloorHinge, GRID_SECTOR_MATRIX } from "./common";
import { vec4, mat4 } from "gl-matrix";
import { sectorOfWall } from "../../../../build/board/query";

export class SectorHelperBuilder extends Builders implements SectorRenderable {
  constructor(
    factory: BuildersFactory,
    readonly ceilpoints = factory.pointSprite('helper'),
    readonly ceilwire = factory.wireframe('helper'),
    readonly ceilhinge = factory.wireframe('helper'),
    readonly ceilgrid = factory.grid('helper').knd(HELPER_GRID),
    readonly floorpoints = factory.pointSprite('helper'),
    readonly floorwire = factory.wireframe('helper'),
    readonly floorhinge = factory.wireframe('helper'),
    readonly floorgrid = factory.grid('helper').knd(HELPER_GRID),
    readonly ceiling = new Renderables([ceilpoints, ceilwire, ceilhinge, ceilgrid]),
    readonly floor = new Renderables([floorpoints, floorwire, floorhinge, floorgrid]),
  ) { super([ceilpoints, ceilwire, ceilhinge, ceilgrid, floorpoints, floorwire, floorhinge, floorgrid]) }
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

function addWallPoint(offset: number, builder: PointSpriteBuilder, ctx: RenderablesCacheContext, ceiling: boolean, wallId: number, d: number): void {
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

function fillBuffersForSectorWireframe(s: number, sec: Sector, heinum: number, z: number, board: Board, builder: WireframeBuilder) {
  const slope = createSlopeCalculator(board, s);
  const buff = builder.buff;
  buff.allocate(sec.wallnum, sec.wallnum * 2);

  let fw = sec.wallptr;
  let off = 0;
  for (let w = 0; w < sec.wallnum; w++) {
    const wid = sec.wallptr + w;
    const wall = board.walls[wid];
    const vx = wall.x;
    const vy = wall.y;
    const vz = (slope(vx, vy, heinum) + z) / ZSCALE;
    buff.writePos(w, vx, vz, vy);
    if (fw != wid) off = buff.writeLine(off, w - 1, w);
    if (wall.point2 == fw) {
      off = buff.writeLine(off, w, fw - sec.wallptr);
      fw = wid + 1;
    }
  }
}

export function updateSectorHelper(cache: BuildRenderableProvider, ctx: RenderablesCacheContext, secId: number, builder: SectorHelperBuilder): SectorHelperBuilder {
  builder = builder == null ? new SectorHelperBuilder(ctx.factory) : builder;
  const pointTex = ctx.art.get(-1);
  const board = ctx.board();
  // builder.ceilpoints.tex = pointTex;
  // builder.floorpoints.tex = pointTex;

  const sec = board.sectors[secId];
  // const wallnum = sec.wallnum;
  // builder.ceilpoints.buff.allocate(wallnum * 4, wallnum * 6);
  // builder.floorpoints.buff.allocate(wallnum * 4, wallnum * 6);
  // for (let i = 0; i < wallnum; i++) {
  //   const w = sec.wallptr + i;
  //   addWallPoint(i, builder.ceilpoints, ctx, true, w, 2.5);
  //   addWallPoint(i, builder.floorpoints, ctx, false, w, 2.5);
  // }

  vec4.set(builder.ceilwire.color, 1, 1, 1, -100);
  vec4.set(builder.floorwire.color, 1, 1, 1, -100);
  fillBuffersForSectorWireframe(secId, sec, sec.ceilingheinum, sec.ceilingz, board, builder.ceilwire);
  fillBuffersForSectorWireframe(secId, sec, sec.floorheinum, sec.floorz, board, builder.floorwire);

  buildCeilingHinge(ctx, secId, builder.ceilhinge);
  buildFloorHinge(ctx, secId, builder.floorhinge);

  const sectorRenderable = cache.sector(secId);
  mat4.copy(builder.ceilgrid.gridTexMat, GRID_SECTOR_MATRIX);
  builder.ceilgrid.solid = <SolidBuilder>sectorRenderable.ceiling;

  mat4.copy(builder.floorgrid.gridTexMat, GRID_SECTOR_MATRIX);
  builder.floorgrid.solid = <SolidBuilder>sectorRenderable.floor;

  return builder;
}