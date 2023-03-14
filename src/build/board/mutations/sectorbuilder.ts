import { BuildReferenceTracker } from "../../../app/apis/app";
import { track } from "../../../app/apis/referencetracker";
import { forEach, map } from "../../../utils/collections";
import { Board, Wall } from "../structs";
import { resizeWalls } from "./internal";
import { fixxrepeat } from "./walls";

export class SectorBuilder {
  private currentLoop: Wall[] = [];
  private walls: Wall[][] = [];

  addWall(wall: Wall): SectorBuilder { this.currentLoop.push(wall); return this }
  addWalls(walls: Iterable<Wall>): SectorBuilder { forEach(walls, w => this.currentLoop.push(w)); return this }
  addLoop(walls: Iterable<Wall>): SectorBuilder { return this.addWalls(walls).loop() }
  *getWalls() { for (const ws of this.walls) for (const w of ws) yield w; }
  wallsLength() { let sum = 0; forEach(this.walls, ws => sum += ws.length); return sum; }

  loop(): SectorBuilder {
    if (this.currentLoop.length == 0) return this;
    this.walls.push(this.currentLoop);
    this.currentLoop = [];
    return this;
  }

  build(board: Board, sectorId: number, refs: BuildReferenceTracker) {
    track(refs.walls, wallRefs => {
      const walls = [...this.getWalls()];
      const nextWallPtrs = [...map(walls, w => wallRefs.ref(w.nextwall))];
      resizeWalls(board, sectorId, walls.length, refs);
      for (let i = 0; i < walls.length; i++) walls[i].nextwall = wallRefs.val(nextWallPtrs[i]);
    });
    const sec = board.sectors[sectorId];
    const repeatsToFix = [];
    let ptr = sec.wallptr;
    for (const ws of this.walls) {
      const start = ptr;
      let lastWall = null;
      for (const wall of ws) {
        lastWall = wall;
        const w = ptr++;
        board.walls[w] = wall;
        wall.point2 = w + 1;
        if (wall.nextwall != -1) {
          const nextwall = board.walls[wall.nextwall];
          nextwall.nextsector = sectorId;
          nextwall.nextwall = w;
        }
        if (wall.xrepeat == 0) repeatsToFix.push(w);
      }
      lastWall.point2 = start;
    }
    repeatsToFix.forEach(w => fixxrepeat(board, w));
  }
}