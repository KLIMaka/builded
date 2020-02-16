import { arcsIntersects, monoatan2, dot2d, len2d } from '../../../libs/mathutils';
import * as GLM from '../../../libs_js/glmatrix';
import { Deck, IndexedDeck } from '../../collections';
import * as PROFILE from '../../profiler';
import { nextwall, packWallSectorId, unpackSectorId, unpackWallId } from './boardutils';
import { Board } from './structs';
import * as U from './utils';
import { View } from './api';

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
      let sec = this.board.sectors[s];
      let endwall = sec.wallptr + sec.wallnum;
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
      if (U.inSector(this.board, this.cx, this.cy, s)) {
        this.visibleSectors.add(s);
        continue;
      }
      let sec = this.board.sectors[s];
      let end = sec.wallptr + sec.wallnum;
      for (let w = sec.wallptr; w < end; w++) {
        let wall = this.board.walls[w];
        if (len2d(this.cx - wall.x, this.cy - wall.y) < this.dist) {
          this.visibleSectors.add(s);
          break;
        }
      }
    }
  }

  forSector<T>(ctx: T, secv: SectorVisitor<T>): void {
    for (let s of this.visibleSectors.keys()) secv(ctx, s);
  }

  forWall<T>(ctx: T, wallv: WallVisitor<T>): void {
    for (let s of this.visibleSectors.keys()) {
      let sec = this.board.sectors[s];
      let end = sec.wallptr + sec.wallnum;
      for (let w = sec.wallptr; w < end; w++) {
        let wall = this.board.walls[w];
        if (len2d(this.cx - wall.x, this.cy - wall.y) < this.dist) {
          wallv(ctx, w, s);
        }
      }
    }
  }

  forSprite<T>(ctx: T, sprv: SpriteVisitor<T>): void {
    for (let s = 0; s < this.board.numsprites; s++) {
      let spr = this.board.sprites[s];
      if (len2d(this.cx - spr.x, this.cy - spr.y) < this.dist) sprv(ctx, s);
    }
  }
}

function wallBehind(board: Board, wallId: number, ms: U.MoveStruct, fwd: GLM.Mat3Array) {
  // return false;
  let wall1 = board.walls[wallId];
  let wall2 = board.walls[wall1.point2];
  let dx1 = wall1.x - ms.x; let dy1 = wall1.y - ms.y;
  let dx2 = wall2.x - ms.x; let dy2 = wall2.y - ms.y;
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
      let s = this.prepvs.get(i);
      let sec = this.board.sectors[s];
      if (sec == undefined) continue;
      let endwall = sec.wallptr + sec.wallnum;
      for (let w = sec.wallptr; w < endwall; w++) {
        if (!U.wallVisible(this.board, w, ms) || wallBehind(this.board, w, ms, fwd)) continue;

        let wall = this.board.walls[w];
        let nextsector = wall.nextsector;
        if (nextsector == -1) continue;
        let nextwall = wall.nextwall;
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
      let wall = this.board.walls[wallId];
      let dx = wall.x - ms.x;
      let dy = wall.y - ms.y;
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
      let ew = entryWalls.get(i);
      let a1s = this.getAngForWall(nextwall(this.board, ew), ms);
      let a1e = this.getAngForWall(ew, ms);
      let a2s = this.getAngForWall(wallId, ms);
      let a2e = this.getAngForWall(nextwall(this.board, wallId), ms);
      if (arcsIntersects(a1s, a1e, a2s, a2e))
        return true;
    }
    return false;
  }


  public visit(board: Board, ms: U.MoveStruct, fwd: GLM.Mat3Array): VisResult {
    this.init(board, ms.sec);
    // this.fillPVS(ms, fwd);
    PROFILE.get(null).inc('pvs', this.prepvs.length());
    let sectors = board.sectors;
    let sec2spr = U.groupSprites(board);
    for (let i = 0; i < this.pvs.length(); i++) {
      let s = this.pvs.get(i);
      let entryWalls = this.ensureEntryWalls(s);
      let sec = sectors[s];
      if (sec == undefined) continue;

      this.sectors.push(s);
      let endwall = sec.wallptr + sec.wallnum;
      for (let w = sec.wallptr; w < endwall; w++) {
        if (!U.wallVisible(board, w, ms)
          || wallBehind(board, w, ms, fwd)
          || !this.visibleFromEntryWalls(w, entryWalls, ms))
          continue;

        this.walls.push(packWallSectorId(w, s));

        let wall = board.walls[w];
        let nextsector = wall.nextsector;
        if (nextsector == -1) continue;
        if (this.pvs.indexOf(nextsector) == -1) {
          this.pvs.push(nextsector);
        }
      }

      let sprs = sec2spr[s];
      if (sprs != undefined) {
        for (let i = 0; i < sprs.length; i++)
          this.sprites.push(sprs[i]);
      }
    }
    PROFILE.get(null).inc('pvs', this.pvs.length());
    return this;
  }

  public forSector<T>(ctx: T, secv: SectorVisitor<T>) {
    for (let i = 0; i < this.sectors.length(); i++)
      secv(ctx, this.sectors.get(i));
  }

  public forWall<T>(ctx: T, wallv: WallVisitor<T>) {
    for (let i = 0; i < this.walls.length(); i++) {
      let id = this.walls.get(i);
      wallv(ctx, unpackWallId(id), unpackSectorId(id));
    }
  }

  public forSprite<T>(ctx: T, sprv: SpriteVisitor<T>) {
    for (let i = 0; i < this.sprites.length(); i++)
      sprv(ctx, this.sprites.get(i));
  }
}