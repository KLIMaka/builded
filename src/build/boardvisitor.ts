import { arcsIntersects, monoatan2, dot2d, len2d, RadialSegments, PI2 } from '../utils/mathutils';
import * as GLM from '../libs_js/glmatrix';
import { Deck, IndexedDeck } from '../utils/collections';
import { Board, Wall } from './board/structs';
import * as U from './utils';
import { inSector, nextwall } from './board/query';

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

  visit(board: Board, campos: GLM.Vec3Array, dist: number): VisResult {
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

function wallBehind(board: Board, wallId: number, ms: U.MoveStruct, fwd: GLM.Mat3Array) {
  // return false;
  const wall1 = board.walls[wallId];
  const wall2 = board.walls[wall1.point2];
  const dx1 = wall1.x - ms.x; const dy1 = wall1.y - ms.y;
  const dx2 = wall2.x - ms.x; const dy2 = wall2.y - ms.y;
  return dot2d(dx1, dy1, fwd[0], fwd[2]) < 0 && dot2d(dx2, dy2, fwd[0], fwd[2]) < 0;
}

export class PvsBoardVisitorResult implements VisResult {
  private sectors = new Deck<number>();
  private walls = new Deck<number>();
  private sprites = new Deck<number>();

  private prepvs = new IndexedDeck<number>();
  private pvs = new IndexedDeck<number>();
  private entryWalls = new Map<number, Deck<number>>();
  private angCache = new Map<number, number>();
  private board: Board;


  private init(board: Board, sectorId: number) {
    this.board = board;
    this.sectors.clear();
    this.walls.clear();
    this.sprites.clear();
    this.prepvs.clear();
    this.prepvs.push(sectorId);
    this.pvs.clear();
    this.pvs.push(sectorId);
    this.angCache.clear();
    this.entryWalls.clear();
  }

  private ensureEntryWalls(sectorId: number) {
    let ewalls = this.entryWalls.get(sectorId);
    if (ewalls == undefined) {
      ewalls = new Deck<number>();
      this.entryWalls.set(sectorId, ewalls);
    }
    return ewalls;
  }

  private fillPVS(ms: U.MoveStruct, fwd: GLM.Mat3Array) {
    for (let i = 0; i < this.prepvs.length(); i++) {
      const s = this.prepvs.get(i);
      const sec = this.board.sectors[s];
      if (sec == undefined) continue;
      const endwall = sec.wallptr + sec.wallnum;
      for (let w = sec.wallptr; w < endwall; w++) {
        if (!U.wallVisible(this.board, w, ms) || wallBehind(this.board, w, ms, fwd)) continue;

        const wall = this.board.walls[w];
        const nextsector = wall.nextsector;
        if (nextsector == -1) continue;
        const nextwall = wall.nextwall;
        if (this.prepvs.indexOf(nextsector) == -1) {
          this.prepvs.push(nextsector);
          this.ensureEntryWalls(nextsector)
            .clear()
            .push(nextwall);
        } else {
          this.ensureEntryWalls(nextsector)
            .push(nextwall);
        }
      }
    }
  }

  private getAngForWall(wallId: number, ms: U.MoveStruct) {
    let ang = this.angCache.get(wallId);
    if (ang == undefined) {
      const wall = this.board.walls[wallId];
      const dx = wall.x - ms.x;
      const dy = wall.y - ms.y;
      ang = monoatan2(dy, dx);
      this.angCache.set(wallId, ang);
    }
    return ang;
  }

  private visibleFromEntryWalls(wallId: number, entryWalls: Deck<number>, ms: U.MoveStruct) {
    return true;
    if (entryWalls.length() == 0)
      return true;
    for (let i = 0; i < entryWalls.length(); i++) {
      const ew = entryWalls.get(i);
      const a1s = this.getAngForWall(nextwall(this.board, ew), ms);
      const a1e = this.getAngForWall(ew, ms);
      const a2s = this.getAngForWall(wallId, ms);
      const a2e = this.getAngForWall(nextwall(this.board, wallId), ms);
      if (arcsIntersects(a1s, a1e, a2s, a2e))
        return true;
    }
    return false;
  }


  public visit(board: Board, ms: U.MoveStruct, fwd: GLM.Mat3Array): VisResult {
    this.init(board, ms.sec);
    // this.fillPVS(ms, fwd);
    const sectors = board.sectors;
    const sec2spr = U.groupSprites(board);
    for (let i = 0; i < this.pvs.length(); i++) {
      const s = this.pvs.get(i);
      const entryWalls = this.ensureEntryWalls(s);
      const sec = sectors[s];
      if (sec == undefined) continue;

      this.sectors.push(s);
      const endwall = sec.wallptr + sec.wallnum;
      for (let w = sec.wallptr; w < endwall; w++) {
        if (!U.wallVisible(board, w, ms)
          || wallBehind(board, w, ms, fwd)
          || !this.visibleFromEntryWalls(w, entryWalls, ms))
          continue;

        this.walls.push(packWallSectorId(w, s));

        const wall = board.walls[w];
        const nextsector = wall.nextsector;
        if (nextsector == -1) continue;
        if (this.pvs.indexOf(nextsector) == -1) {
          this.pvs.push(nextsector);
        }
      }

      const sprs = sec2spr[s];
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

export class RadialBoardVisitorResult implements VisResult {
  private sectors = new Deck<number>();
  private walls = new Deck<number>();
  private sprites = new Deck<number>();
  private pvs = new IndexedDeck<number>();

  public visit(board: Board, ms: U.MoveStruct, fwd: GLM.Mat3Array): VisResult {
    this.sectors.clear();
    this.walls.clear();
    this.sprites.clear();
    this.pvs.clear().push(ms.sec)

    const sectors = board.sectors;
    const sec2spr = U.groupSprites(board);
    const rad = new RadialSegments();
    const nonvoidWalls = new Deck<Wall>();

    for (let i = 0; i < this.pvs.length(); i++) {
      const s = this.pvs.get(i);

      const sec = sectors[s];
      if (sec == undefined) continue;

      this.sectors.push(s);
      const endwall = sec.wallptr + sec.wallnum;
      nonvoidWalls.clear();
      for (let w = sec.wallptr; w < endwall; w++) {
        if (!U.wallVisible(board, w, ms)) continue;

        this.walls.push(packWallSectorId(w, s));

        const wall1 = board.walls[w];
        const wall2 = board.walls[wall1.point2];
        const tw1x = wall1.x - ms.x;
        const tw1y = wall1.y - ms.y;
        const tw2x = wall2.x - ms.x;
        const tw2y = wall2.y - ms.y;
        const l1 = len2d(tw1x, tw1y);
        const l2 = len2d(tw2x, tw2y);
        const minl = Math.min(l1, l2);
        const start = monoatan2(tw1y, tw1x) / PI2;
        const end = monoatan2(tw2y, tw2x) / PI2;

        const nextsector = wall1.nextsector;
        const segment = { start, end, value: minl };
        if (nextsector != -1) {
          if (rad.scan(segment))
            this.pvs.push(nextsector);
        } else {
          rad.add(segment);
        }
      }

      const sprs = sec2spr[s];
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