import { BuildReferenceTracker } from "../../../app/apis/app";
import { track } from "../../../app/apis/referencetracker";
import { Deck, map, forEach, enumerate } from "../../../utils/collections";
import { Wall, Board } from "../structs";
import { resizeWalls } from "./internal";

export class SectorBuilder {
  private walls = new Deck<Wall>();
  private looppoints = new Deck<number>();

  addWall(wall: Wall): SectorBuilder { this.walls.push(wall); return this }
  addWalls(walls: Iterable<Wall>): SectorBuilder { this.walls.pushAll(walls); return this }
  addLoop(walls: Iterable<Wall>): SectorBuilder { return this.addWalls(walls).loop() }
  getWalls() { return this.walls }

  loop(): SectorBuilder {
    if (this.walls.length() == 0 || this.looppoints.top() == this.walls.length()) return this;
    this.looppoints.push(this.walls.length());
    return this;
  }

  build(board: Board, sectorId: number, refs: BuildReferenceTracker) {
    track(refs.walls, wallRefs => {
      const nextWallPtrs = [...map(this.walls, w => wallRefs.ref(w.nextwall))];
      resizeWalls(board, sectorId, this.walls.length(), refs);
      forEach(enumerate(this.walls), ([w, i]) => w.nextwall = wallRefs.val(nextWallPtrs[i]));
    });
    const sec = board.sectors[sectorId];
    const loopIter = this.looppoints[Symbol.iterator]();
    let loopStart = sec.wallptr;
    let loopEnd = loopIter.next().value;
    for (let [wall, i] of enumerate(this.walls)) {
      const w = i + sec.wallptr;
      board.walls[w] = wall;
      if (loopEnd == i + 1) {
        wall.point2 = loopStart;
        loopStart = w + 1;
        loopEnd = loopIter.next().value;
      } else {
        wall.point2 = w + 1;
      }
      if (wall.nextwall != -1) {
        const nextwall = board.walls[wall.nextwall];
        nextwall.nextsector = sectorId;
        nextwall.nextwall = w;
      }
    }
  }
}