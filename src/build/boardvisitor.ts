import { Function } from 'ts-utils/types';
import { BuildTror } from 'app/apis/engine';
import { vec3 } from 'gl-matrix';
import { Deck } from 'ts-utils/collections';
import { RadialSegment, RadialSegments, TWO_PI, createSegment, dot2d, len2d, monoatan2 } from 'ts-utils/mathutils';
import { inSector } from './board/query';
import { Board, Sector } from './board/structs';
import { MoveStruct, ZSCALE, wallVisible } from './utils';

export function packWallSectorId(wallId: number, sectorId: number) {
  return wallId | (sectorId << 16)
}

export function unpackWallId(wallSectorId: number) {
  return wallSectorId & 0xffff;
}

export function unpackSectorId(wallSectorId: number) {
  return (wallSectorId >> 16) & 0xffff;
}


export interface VisResult {
  forSector(secv: SectorVisitor): void;
  forWall(wallv: WallVisitor): void;
  forSprite(sprv: SpriteVisitor): void;
}

export type SectorVisitor = (sectorId: number) => void;
export type WallVisitor = (wallId: number, sectorId: number, dist: number) => void;
export type SpriteVisitor = (spriteId: number, dist: number) => void;

export type SectorPredicate = (sectorId: number) => boolean;
export type WallPredicate = (wallId: number, dist: number) => boolean;
export type SpritePredicate = (spriteId: number, dist: number) => boolean;


export class TopDownBoardVisitorResult implements VisResult {
  private board: Board;
  private cx: number;
  private cy: number;
  private dist: number;
  private visibleSectors = new Set<number>();

  visit(board: Board, campos: vec3, dist: number): VisResult {
    this.board = board;
    this.cx = campos[0];
    this.cy = campos[2];
    this.dist = dist;
    this.prescan();
    return this;
  }

  private prescan() {
    this.visibleSectors.clear();
    for (let s = 0; s < this.board.numsectors; s++) {
      if (inSector(this.board, this.cx, this.cy, s)) {
        this.visibleSectors.add(s);
        continue;
      }
      const sec = this.board.sectors[s];
      const end = sec.wallptr + sec.wallnum;
      for (let w = sec.wallptr; w < end; w++) {
        const wall = this.board.walls[w];
        if (len2d(this.cx - wall.x, this.cy - wall.y) < this.dist) {
          this.visibleSectors.add(s);
          break;
        }
      }
    }
  }

  forSector(secv: SectorVisitor): void {
    for (const s of this.visibleSectors.keys()) secv(s);
  }

  forWall(wallv: WallVisitor): void {
    for (const s of this.visibleSectors.keys()) {
      const sec = this.board.sectors[s];
      const end = sec.wallptr + sec.wallnum;
      for (let w = sec.wallptr; w < end; w++) {
        const wall = this.board.walls[w];
        if (len2d(this.cx - wall.x, this.cy - wall.y) < this.dist) {
          wallv(w, s);
        }
      }
    }
  }

  forSprite(sprv: SpriteVisitor): void {
    for (let s = 0; s < this.board.numsprites; s++) {
      const spr = this.board.sprites[s];
      if (len2d(this.cx - spr.x, this.cy - spr.y) < this.dist) sprv(s);
    }
  }
}


function wallBehind(board: Board, sector: Sector, wallId: number, ms: MoveStruct, fwd: vec3) {
  const wall1 = board.walls[wallId];
  const wall2 = board.walls[wall1.point2];
  const dx1 = wall1.x - ms.x; const dy1 = wall1.y - ms.y;
  const dx2 = wall2.x - ms.x; const dy2 = wall2.y - ms.y;
  const minl = Math.min(len2d(dx1, dy1), len2d(dx2, dy2));
  const lk = -Math.abs((fwd[1] < 0 ? sector.floorz : sector.ceilingz) - ms.z) / ZSCALE * Math.abs(fwd[1]);
  return minl > lk * 2 && dot2d(dx1, dy1, fwd[0], fwd[2]) < 0 && dot2d(dx2, dy2, fwd[0], fwd[2]) < 0;
}

function calcSegment(board: Board, wallId: number, ms: MoveStruct, ismin: boolean) {
  const wall1 = board.walls[wallId];
  const wall2 = board.walls[wall1.point2];
  const tw1x = wall1.x - ms.x;
  const tw1y = wall1.y - ms.y;
  const tw2x = wall2.x - ms.x;
  const tw2y = wall2.y - ms.y;
  const l1 = len2d(tw1x, tw1y);
  const l2 = len2d(tw2x, tw2y);
  const value = ismin ? Math.min(l1, l2) : Math.max(l1, l2);
  const start = monoatan2(tw1y, tw1x) / TWO_PI;
  const end = monoatan2(tw2y, tw2x) / TWO_PI;
  return createSegment(start, end, value);
}

function calcSegmentSprite(board: Board, spriteId: number, ms: MoveStruct): RadialSegment {
  const spr = board.sprites[spriteId];
  const dx = spr.x - ms.x;
  const dy = spr.y - ms.y;
  const l = len2d(dx, dy);
  const start = monoatan2(dy, dx) / TWO_PI;
  return createSegment(start, start, l);
}

class VisResultImpl implements VisResult {

  constructor(
    private sectors: number[] = [],
    private walls: [number, number, number][] = [],
    private sprites: [number, number][] = []) { }

  forSector(secv: SectorVisitor) { this.sectors.forEach(secv) }
  forWall(wallv: WallVisitor) { this.walls.forEach(([w, s, d]) => wallv(w, s, d)) }
  forSprite(sprv: SpriteVisitor) { this.sprites.forEach(([s, d]) => sprv(s, d)) }
}

export function visitFromSector(ms: MoveStruct, fwd: vec3, board: Board, tror: BuildTror, spritesBySector: Function<number, number[]>): VisResult {
  const visitedSectors = new Set<number>();
  const sectors: number[] = [];
  const walls: [number, number, number][] = [];
  const sprites: [number, number][] = [];

  function visitTrorBunch(pvsStart: number[]) {
    const rad = new RadialSegments();
    const pvs = new Set<number>(pvsStart);
    const nonvoidWalls = new Deck<number>();

    for (const s of pvs) {
      if (visitedSectors.has(s)) continue;

      const sec = board.sectors[s];
      if (!sec) continue;

      visitedSectors.add(s);
      sectors.push(s);
      const endwall = sec.wallptr + sec.wallnum;
      nonvoidWalls.clear();
      for (let w = sec.wallptr; w < endwall; w++) {
        if (!wallVisible(board, w, ms) || wallBehind(board, sec, w, ms, fwd)) continue;
        const wall = board.walls[w];
        if (wall.nextsector !== -1 && !wall.cstat.oneWay) {
          nonvoidWalls.push(w);
        } else if (rad.scan(calcSegment(board, w, ms, true))) {
          const dist = len2d(wall.x - ms.x, wall.y - ms.y);
          walls.push([w, s, dist]);
          rad.add(calcSegment(board, w, ms, false));
        }
      }

      for (const w of nonvoidWalls) {
        const wall = board.walls[w];
        if (rad.scan(calcSegment(board, w, ms, true))) {
          const dist = len2d(wall.x - ms.x, wall.y - ms.y);
          walls.push([w, s, dist]);
          pvs.add(wall.nextsector);
        }
      }

      const sprs = spritesBySector(s);
      if (sprs !== undefined) {
        sprs.forEach(s => {
          const spr = board.sprites[s];
          const dist = len2d(spr.x - ms.x, spr.y - ms.y);
          sprites.push([s, dist]);
        });
      }

      const ceiling = tror.ceiling(s);
      if (ceiling.length !== 0) visitTrorBunch(ceiling);
      const floor = tror.floor(s);
      if (floor.length !== 0) visitTrorBunch(floor);
    }
  }

  visitTrorBunch([ms.sec]);
  return new VisResultImpl(sectors, walls, sprites);
}
