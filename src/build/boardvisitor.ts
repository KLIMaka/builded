import { BoardUtils } from 'app/apis/app';
import { Vec3Array } from '../libs_js/glmatrix';
import { Deck, IndexedDeck } from '../utils/collections';
import { createSegment, dot2d, len2d, monoatan2, PI2, RadialSegments } from '../utils/mathutils';
import { inSector } from './board/query';
import { Board, Sector } from './board/structs';
import { MoveStruct, wallVisible, ZSCALE } from './utils';

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
  forSector<T>(ctx: T, secv: SectorVisitor<T>): void;
  forWall<T>(ctx: T, wallv: WallVisitor<T>): void;
  forSprite<T>(ctx: T, sprv: SpriteVisitor<T>): void;
}

export type SectorVisitor<T> = (ctx: T, sectorId: number) => void;
export type SectorPredicate<T> = (ctx: T, sectorId: number) => boolean;
export type WallVisitor<T> = (ctx: T, wallId: number, sectorId: number) => void;
export type WallPredicate<T> = (ctx: T, wallId: number, sectorId: number) => boolean;
export type SpriteVisitor<T> = (ctx: T, spriteId: number) => void;
export type SpritePredicate<T> = (ctx: T, spriteId: number) => boolean;

export class SectorCollector<T> {
  private visitor: SectorVisitor<T>;
  public sectors = new Deck<number>();

  constructor(pred: SectorPredicate<T>) {
    this.visitor = (ctx: T, sectorId: number) => {
      if (pred(ctx, sectorId))
        this.sectors.push(sectorId);
    }
  }

  public visit(): SectorVisitor<T> {
    this.sectors.clear();
    return this.visitor;
  }
}

export function createSectorCollector<T>(pred: SectorPredicate<T>) {
  return new SectorCollector(pred);
}

export class WallCollector<T> {
  private visitor: WallVisitor<T>;
  public walls = new Deck<number>();

  constructor(pred: WallPredicate<T>) {
    this.visitor = (ctx: T, wallId: number, sectorId: number) => {
      if (pred(ctx, wallId, sectorId))
        this.walls.push(packWallSectorId(wallId, sectorId));
    }
  }

  public visit(): WallVisitor<T> {
    this.walls.clear();
    return this.visitor;
  }
}

export function createWallCollector<T>(pred: WallPredicate<T>) {
  return new WallCollector(pred);
}

export class SpriteCollector<T> {
  private visitor: SpriteVisitor<T>;
  public sprites = new Deck<number>();

  constructor(pred: SpritePredicate<T>) {
    this.visitor = (ctx: T, spriteId: number) => {
      if (pred(ctx, spriteId))
        this.sprites.push(spriteId);
    }
  }

  public visit(): SectorVisitor<T> {
    this.sprites.clear();
    return this.visitor;
  }
}

export function createSpriteCollector<T>(pred: SpritePredicate<T>) {
  return new SpriteCollector(pred);
}


export class AllBoardVisitorResult implements VisResult {
  private board: Board;

  visit(board: Board): VisResult {
    this.board = board;
    return this;
  }

  public forSector<T>(ctx: T, secv: SectorVisitor<T>) {
    for (let s = 0; s < this.board.numsectors; s++)
      secv(ctx, s);
  }

  public forWall<T>(ctx: T, wallv: WallVisitor<T>) {
    for (let s = 0; s < this.board.numsectors; s++) {
      const sec = this.board.sectors[s];
      const endwall = sec.wallptr + sec.wallnum;
      for (let w = sec.wallptr; w < endwall; w++)
        wallv(ctx, w, s);
    }
  }

  public forSprite<T>(ctx: T, sprv: SpriteVisitor<T>) {
    for (let s = 0; s < this.board.numsprites; s++)
      sprv(ctx, s);
  }
}

export class TopDownBoardVisitorResult implements VisResult {
  private board: Board;
  private cx: number;
  private cy: number;
  private dist: number;
  private visibleSectors = new Set<number>();

  visit(board: Board, campos: Vec3Array, dist: number): VisResult {
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

  forSector<T>(ctx: T, secv: SectorVisitor<T>): void {
    for (const s of this.visibleSectors.keys()) secv(ctx, s);
  }

  forWall<T>(ctx: T, wallv: WallVisitor<T>): void {
    for (const s of this.visibleSectors.keys()) {
      const sec = this.board.sectors[s];
      const end = sec.wallptr + sec.wallnum;
      for (let w = sec.wallptr; w < end; w++) {
        const wall = this.board.walls[w];
        if (len2d(this.cx - wall.x, this.cy - wall.y) < this.dist) {
          wallv(ctx, w, s);
        }
      }
    }
  }

  forSprite<T>(ctx: T, sprv: SpriteVisitor<T>): void {
    for (let s = 0; s < this.board.numsprites; s++) {
      const spr = this.board.sprites[s];
      if (len2d(this.cx - spr.x, this.cy - spr.y) < this.dist) sprv(ctx, s);
    }
  }
}

function wallBehind(board: Board, sector: Sector, wallId: number, ms: MoveStruct, fwd: Vec3Array) {
  const wall1 = board.walls[wallId];
  const wall2 = board.walls[wall1.point2];
  const dx1 = wall1.x - ms.x; const dy1 = wall1.y - ms.y;
  const dx2 = wall2.x - ms.x; const dy2 = wall2.y - ms.y;
  const minl = Math.min(len2d(dx1, dy1), len2d(dx2, dy2));
  const lk = -Math.abs((fwd[1] < 0 ? sector.floorz : sector.ceilingz) - ms.z) / ZSCALE * Math.abs(fwd[1]);
  return minl > lk * 2 && dot2d(dx1, dy1, fwd[0], fwd[2]) < 0 && dot2d(dx2, dy2, fwd[0], fwd[2]) < 0;
}

export class PvsBoardVisitorResult implements VisResult {
  private sectors = new Deck<number>();
  private walls = new Deck<number>();
  private sprites = new Deck<number>();
  private pvs = new IndexedDeck<number>();
  private nonvoidWalls = new Deck<number>();
  private rad = new RadialSegments();

  private calcSegment(board: Board, wallId: number, ms: MoveStruct, ismin: boolean) {
    const wall1 = board.walls[wallId];
    const wall2 = board.walls[wall1.point2];
    const tw1x = wall1.x - ms.x;
    const tw1y = wall1.y - ms.y;
    const tw2x = wall2.x - ms.x;
    const tw2y = wall2.y - ms.y;
    const l1 = len2d(tw1x, tw1y);
    const l2 = len2d(tw2x, tw2y);
    const value = ismin ? Math.min(l1, l2) : Math.max(l1, l2);
    const start = monoatan2(tw1y, tw1x) / PI2;
    const end = monoatan2(tw2y, tw2x) / PI2;
    return createSegment(start, end, value);
  }

  public visit(board: Board, boardUtils: BoardUtils, ms: MoveStruct, fwd: Vec3Array): VisResult {
    this.sectors.clear();
    this.walls.clear();
    this.sprites.clear();
    this.nonvoidWalls.clear();
    this.rad.clear();
    this.pvs.clear().push(ms.sec)

    for (let i = 0; i < this.pvs.length(); i++) {
      const s = this.pvs.get(i);

      const sec = board.sectors[s];
      if (sec == undefined) continue;

      this.sectors.push(s);
      const endwall = sec.wallptr + sec.wallnum;
      this.nonvoidWalls.clear();
      for (let w = sec.wallptr; w < endwall; w++) {
        if (!wallVisible(board, w, ms) || wallBehind(board, sec, w, ms, fwd)) continue;
        const wall1 = board.walls[w];
        if (wall1.nextsector != -1) {
          this.nonvoidWalls.push(w);
          continue;
        }
        if (this.rad.scan(this.calcSegment(board, w, ms, true))) {
          this.walls.push(packWallSectorId(w, s));
          this.rad.add(this.calcSegment(board, w, ms, false));
        }
      }

      for (const w of this.nonvoidWalls) {
        const wall1 = board.walls[w];
        if (this.rad.scan(this.calcSegment(board, w, ms, true))) {
          this.walls.push(packWallSectorId(w, s));
          this.pvs.push(wall1.nextsector);
        }
      }

      const sprs = boardUtils.spritesBySector(s);
      if (sprs != undefined) {
        for (let i = 0; i < sprs.length; i++)
          this.sprites.push(sprs[i]);
      }
    }
    return this;
  }

  public forSector<T>(ctx: T, secv: SectorVisitor<T>) {
    for (let i = 0; i < this.sectors.length(); i++)
      secv(ctx, this.sectors.get(i));
  }

  public forWall<T>(ctx: T, wallv: WallVisitor<T>) {
    for (let i = 0; i < this.walls.length(); i++) {
      const id = this.walls.get(i);
      wallv(ctx, unpackWallId(id), unpackSectorId(id));
    }
  }

  public forSprite<T>(ctx: T, sprv: SpriteVisitor<T>) {
    for (let i = 0; i < this.sprites.length(); i++)
      sprv(ctx, this.sprites.get(i));
  }
}