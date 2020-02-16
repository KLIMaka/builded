import { Board, Sprite } from "./structs";
import { List, Node } from "../../../libs/list";
import { lastwall, nextwall } from "./boardutils";

class BoardVersioner {
  private version = 0;

  public incVersion() { this.version++ }
  public getVersion() { return this.version }
  public getWallId(version: number, id: number) { return this.version == version ? id : -1 }
}

export type Pointer = Node<number>;

export class BoardHelper {
  private spritesBySector: Map<number, List<number>> = new Map();
  private prevWallCache: Map<number, number> = new Map();

  private sectorPointers: List<number> = new List();
  private wallPointers: List<number> = new List();
  private spritePointers: List<number> = new List();

  constructor(
    readonly board: Board
  ) {
    this.fillSpritesBySector();
  }

  private updatePointersDelete(ptrs: List<number>, id: number) {
    for (let n = ptrs.first(); n != ptrs.terminator(); n = n.next) {
      if (n.obj == id) n.obj = -1;
      if (n.obj > id) n.obj--;
    }
  }

  private deleteElements<T>(arr: Array<T>, arrlen: number, ptr: number, size: number) {
    for (let i = ptr; i < arrlen - size; i++)
      arr[i] = arr[i + size];
    for (let i = arrlen - size; i < arrlen; i++)
      arr[i] = null
  }

  private insertNulls<T>(arr: Array<T>, arrlen: number, beforeptr: number, size: number) {
    for (let i = arrlen - 1; i >= beforeptr; i--)
      arr[i + size] = arr[i];
    for (let i = 0; i < size; i++)
      arr[i + beforeptr] = null;
  }

  private ensureSpritesList(sectorId: number): List<number> {
    let sprites = this.spritesBySector.get(sectorId);
    if (sprites == undefined) {
      sprites = new List();
      this.spritesBySector.set(sectorId, sprites);
    }
    return sprites;
  }

  private fillSpritesBySector() {
    for (let s = 0; s < this.board.numsprites; s++) {
      let spr = this.board.sprites[s];
      this.ensureSpritesList(spr.sectnum).push(s);
    }
  }

  public insertSprite(spr: Sprite) {
    let idx = this.board.numsprites++;
    this.board.sprites[idx] = spr;
    this.ensureSpritesList(spr.sectnum).push(idx);
  }

  public deleteSprite(spriteId: number) {
    this.deleteElements(this.board.sprites, this.board.numsprites, spriteId, 1);
    this.updatePointersDelete(this.spritePointers, spriteId);
    this.board.numsprites--;
    for (let [, l] of this.spritesBySector) {
      for (let n = l.first(); n != l.terminator(); n = n.next) {
        if (n.obj == spriteId) l.remove(n);
        if (n.obj > spriteId) n.obj--;
      }
    }
  }

  public updateSpriteSector(spriteId: number, newSectorId: number): boolean {
    let spr = this.board.sprites[spriteId];
    if (newSectorId == spr.sectnum) return false;
    let sectorSprites = this.spritesBySector.get(spr.sectnum);
    for (let s = sectorSprites.first(); s != sectorSprites.terminator(); s = s.next) {
      if (s.obj == spriteId) {
        sectorSprites.remove(s);
        break;
      }
    }
    this.ensureSpritesList(newSectorId).push(spriteId);
    return true;
  }

  public spritePtr(spriteId: number): Pointer {
    return this.spritePointers.push(spriteId);
  }

  public returnSpritePtr(ptr: Pointer): void {
    this.spritePointers.remove(ptr);
  }

  public sectorPtr(sectorId: number): Pointer {
    return this.sectorPointers.push(sectorId);
  }

  public returnSectorPtr(ptr: Pointer): void {
    this.sectorPointers.remove(ptr);
  }

  public wallPtr(wallId: number): Pointer {
    return this.wallPointers.push(wallId);
  }

  public returnWallPtr(ptr: Pointer): void {
    this.wallPointers.remove(ptr);
  }

  public prevwall(wallId: number): number {
    let prev = this.prevWallCache.get(wallId);
    if (prev == undefined) {
      prev = lastwall(this.board, wallId);
      this.prevWallCache.set(wallId, prev);
    }
    return prev;
  }

  public nextwall(wallId: number): number {
    return nextwall(this.board, wallId);
  }


}