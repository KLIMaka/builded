import { sectorWalls } from "../../../build/board/loops";
import { ANGSCALE, wallNormal } from "../../../build/utils";
import { Mat2Array, mat2d, Mat2dArray, vec2, Vec2Array, vec3 } from "../../../libs_js/glmatrix";
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

  private sector(sectorId: number, ceiling: boolean): Mat2dArray {
    const board = this.board();
    const sector = board.sectors[sectorId];
    const n = wallNormal(vec3.create(), board, sector.wallptr);
    const K = Math.atan(((ceiling ? sector.ceilingheinum : sector.floorheinum) * ANGSCALE) / (Math.PI / 2));
    const sx = 1 + Math.abs(n[0] * K);
    const sy = 1 + Math.abs(n[2] * K);
    const bb = boundingBox(map(sectorWalls(board, sectorId), w => vec2.fromValues(board.walls[w].x, board.walls[w].y)));
    const m = mat2d.create();
    mat2d.translate(m, m, [-bb.minx, -bb.miny]);
    mat2d.scale(m, m, [sx, sy]);
    return m;
  }

  // private wall(wallId: number): Mat2dArray {
  //   const board = this.board();
  //   const wall1 = board.walls[wallId];
  //   const wall2 = board.walls[wall1.point2];
  //   const dx = wall2.x - wall1.x;
  //   const dy = wall2.y - wall1.y;


  // }

}