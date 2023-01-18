import { sectorOfWall } from "build/board/query";
import { EntityType } from "build/hitscan";
import { int } from "utils/mathutils";
import { sectorWalls } from "../../../build/board/loops";
import { ANGSCALE, createSlopeCalculator, wallNormal, ZSCALE } from "../../../build/utils";
import { Mat2Array, mat2d, Mat2dArray, mat4, Mat4Array, vec2, Vec2Array, vec3 } from "../../../libs_js/glmatrix";
import { map } from "../../../utils/collections";
import { create, Injector, provider } from "../../../utils/injector";
import { BOARD, BoardProvider, Lightmaps } from "../../apis/app";

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
  let minx = Number.MAX_VALUE;
  let miny = Number.MAX_VALUE;
  let maxx = Number.MIN_VALUE;
  let maxy = Number.MIN_VALUE;
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
  ) { }

  ceiling(sectorId: number): Mat2dArray { return this.sector(sectorId, true) }
  floor(sectorId: number): Mat2dArray { return this.sector(sectorId, false) }
  lowerWall(wallId: number): Mat4Array { return this.wall1(wallId, EntityType.LOWER_WALL) }
  upperWall(wallId: number): Mat4Array { return this.wall1(wallId, EntityType.UPPER_WALL) }
  midWall(wallId: number): Mat4Array { return this.wall1(wallId, EntityType.MID_WALL) }

  private sector(sectorId: number, ceiling: boolean): Mat2dArray {
    const board = this.board();
    const sector = board.sectors[sectorId];
    const n = wallNormal(vec3.create(), board, sector.wallptr);
    const K = (ceiling ? sector.ceilingheinum : sector.floorheinum) * ANGSCALE;
    const sx = 1 + Math.abs(n[0] * K);
    const sy = 1 + Math.abs(n[2] * K);
    const bb = boundingBox(map(sectorWalls(board, sectorId), w => vec2.fromValues(board.walls[w].x, board.walls[w].y)));
    const m = mat2d.create();
    const dsx = (Math.ceil(bb.width() / 256) * 256) / bb.width();
    const dsy = (Math.ceil(bb.height() / 256) * 256) / bb.height();
    mat2d.translate(m, m, [-bb.minx, -bb.miny]);
    mat2d.scale(m, m, [sx * dsx, sy * dsy]);
    return m;
  }

  private wall1(wallId: number, type: (EntityType.LOWER_WALL | EntityType.MID_WALL | EntityType.UPPER_WALL)): Mat4Array {
    const board = this.board();
    const wall1 = board.walls[wallId];
    const wall2 = board.walls[wall1.point2];
    const sectorId = sectorOfWall(board, wallId);
    const sector = board.sectors[sectorId];
    const slope = createSlopeCalculator(board, sectorId);
    if (type == EntityType.MID_WALL || type == EntityType.UPPER_WALL) {
      const zbase = Math.min(
        slope(wall1.x, wall1.y, sector.ceilingheinum) + sector.ceilingz,
        slope(wall2.x, wall2.y, sector.ceilingheinum) + sector.ceilingz);
      return this.wall(wallId, zbase);
    } else if (type == EntityType.LOWER_WALL) {
      const nextsectorId = wall1.nextsector;
      const nextsector = board.sectors[nextsectorId];
      const nextslope = createSlopeCalculator(board, nextsectorId);
      const zbase = Math.min(
        nextslope(wall1.x, wall1.y, nextsector.floorheinum) + nextsector.floorz,
        nextslope(wall2.x, wall2.y, nextsector.floorheinum) + nextsector.floorz);
      return this.wall(wallId, zbase);
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
    mat4.translate(m, m, [-wall1.x, -zbase / ZSCALE, - wall1.y, 0]);
    return m;
  }
}