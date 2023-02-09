import { sectorOfWall } from "build/board/query";
import { EntityType } from "build/hitscan";
import { sectorWalls } from "../../../build/board/loops";
import { ANGSCALE, createSlopeCalculator, getWallCoords, wallNormal, ZSCALE } from "../../../build/utils";
import { mat2d, Mat2dArray, mat4, Mat4Array, vec2, Vec2Array, vec3, vec4 } from "../../../libs_js/glmatrix";
import { first, map, range } from "../../../utils/collections";
import { create, Injector, provider } from "../../../utils/injector";
import { BOARD, BoardProvider, Lightmaps } from "../../apis/app";
import { Packer, Rect } from "../../../utils/texcoordpacker";

class BoundingBox {
  constructor(
    readonly minx: number,
    readonly miny: number,
    readonly maxx: number,
    readonly maxy: number
  ) { }
  width() { return this.maxx - this.minx }
  height() { return this.maxy - this.miny }
};

function boundingBox(vtxs: Iterable<Vec2Array>): BoundingBox {
  let minx = Number.POSITIVE_INFINITY;
  let miny = Number.POSITIVE_INFINITY;
  let maxx = Number.NEGATIVE_INFINITY;
  let maxy = Number.NEGATIVE_INFINITY;
  for (const v of vtxs) {
    minx = Math.min(minx, v[0]);
    miny = Math.min(miny, v[1]);
    maxx = Math.max(maxx, v[0]);
    maxy = Math.max(maxy, v[1]);
  }
  return new BoundingBox(minx, miny, maxx, maxy);
}

export const DefaultLightmapsConstructor = provider(async (injector: Injector) => {
  return await create(injector, LightmapsImpl, BOARD);
});


class LightmapsImpl implements Lightmaps {
  constructor(
    private board: BoardProvider,
    private packer = new Packer(1024, 1024)
  ) { }

  ceiling(sectorId: number): Mat2dArray { return this.sector(sectorId, true) }
  floor(sectorId: number): Mat2dArray { return this.sector(sectorId, false) }
  lowerWall(wallId: number): Mat4Array { return this.wall1(wallId, EntityType.LOWER_WALL) }
  upperWall(wallId: number): Mat4Array { return this.wall1(wallId, EntityType.UPPER_WALL) }
  midWall(wallId: number): Mat4Array { return this.wall1(wallId, EntityType.MID_WALL) }

  private sector(sectorId: number, ceiling: boolean): Mat2dArray {
    return mat2d.create();
    const board = this.board();
    const sector = board.sectors[sectorId];
    const n = wallNormal(vec3.create(), board, sector.wallptr);
    const K = (ceiling ? sector.ceilingheinum : sector.floorheinum) * ANGSCALE;
    const sx = 1 + Math.abs(n[0] * K);
    const sy = 1 + Math.abs(n[2] * K);
    const bb = boundingBox(map(sectorWalls(board, sectorId), w => vec2.fromValues(board.walls[w].x * sx, board.walls[w].y * sy)));
    const tx = Math.round(bb.width() / 256);
    const ty = Math.round(bb.height() / 256);
    const dsx = (tx * 256) / bb.width();
    const dsy = (ty * 256) / bb.height();
    const r = this.packer.pack(new Rect(tx, ty));
    if (r == null) return mat2d.create();
    const xoff = r.xoff / 1024;
    const yoff = r.yoff / 1024;
    const m = mat2d.create();
    mat2d.scale(m, m, [1 / 256, 1 / 256]);
    mat2d.translate(m, m, [xoff, yoff]);
    mat2d.scale(m, m, [dsx * sx, dsy * sy]);
    mat2d.translate(m, m, [-bb.minx / sx, -bb.miny / sy]);
    return m;
  }

  private wall1(wallId: number, type: (EntityType.LOWER_WALL | EntityType.MID_WALL | EntityType.UPPER_WALL)): Mat4Array {
    return mat4.create();
    const coords = this.getCoords(wallId, type);
    if (coords == null) return mat4.create();
    const maxz = Math.max(...map(range(0, 4), i => coords[i * 3 + 2]));
    const m = this.wall(wallId, maxz);
    const bb = boundingBox(map(range(0, 4), i => vec4.transformMat4(vec4.create(), vec4.fromValues(coords[i * 3], coords[i * 3 + 2], coords[i * 3 + 1], 1), m)));
    const tx = Math.round(bb.width() / 256);
    const ty = Math.round(bb.height() / 256);
    const dsx = (tx * 256) / bb.width();
    const dsy = (ty * 256) / bb.height();
    const r = this.packer.pack(new Rect(tx, ty));
    if (r == null) return mat4.create();
    const xoff = r.xoff / 1024;
    const yoff = r.yoff / 1024;
    const t = mat4.create();
    mat4.scale(t, t, [1 / 256, 1 / 256, 1, 1]);
    mat4.translate(m, m, [xoff, yoff, 0, 0]);
    mat4.scale(t, t, [dsx, dsy, 1, 1]);
    mat4.mul(t, t, m);
    return t;
  }

  private getCoords(wallId: number, type: (EntityType.LOWER_WALL | EntityType.MID_WALL | EntityType.UPPER_WALL)): number[] {
    const board = this.board();
    const wall1 = board.walls[wallId];
    const wall2 = board.walls[wall1.point2];
    const sectorId = sectorOfWall(board, wallId);
    const sector = board.sectors[sectorId];
    const slope = createSlopeCalculator(board, sectorId);
    const [x1, y1, x2, y2] = [wall1.x, wall1.y, wall2.x, wall2.y];
    const ceilingheinum = sector.ceilingheinum;
    const floorheinum = sector.floorheinum;
    const ceilingz = sector.ceilingz;
    const floorz = sector.floorz;
    if (type == EntityType.MID_WALL)
      return getWallCoords(x1, y1, x2, y2, slope, slope, ceilingheinum, floorheinum, ceilingz, floorz, false);
    else {
      const nextsector = board.sectors[wall1.nextsector];
      const nextslope = createSlopeCalculator(board, wall1.nextsector);
      const nextfloorheinum = nextsector.floorheinum;
      const nextfloorz = nextsector.floorz;
      const nextceilingheinum = nextsector.ceilingheinum;
      const nextceilingz = nextsector.ceilingz;
      switch (type) {
        case EntityType.LOWER_WALL: return getWallCoords(x1, y1, x2, y2, nextslope, slope, nextfloorheinum, floorheinum, nextfloorz, floorz, true);
        case EntityType.UPPER_WALL: return getWallCoords(x1, y1, x2, y2, slope, nextslope, ceilingheinum, nextceilingheinum, ceilingz, nextceilingz, true);
      }
    }
  }

  private wall(wallId: number, zbase: number): Mat4Array {
    const board = this.board();
    const wall1 = board.walls[wallId];
    const wall2 = board.walls[wall1.point2];
    const dx = wall2.x - wall1.x;
    const dy = wall2.y - wall1.y;
    const m = mat4.create();
    mat4.rotateY(m, m, -Math.atan2(-dy, dx));
    mat4.translate(m, m, [-wall1.x, -zbase, - wall1.y, 0]);
    return m;
  }
}