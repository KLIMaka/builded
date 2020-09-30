import { BuildReferenceTracker } from "../../app/apis/app";
import { track } from "../../app/apis/referencetracker";
import { cyclicPairs, Deck, enumerate, forEach, map, range } from "../../utils/collections";
import { iter } from "../../utils/iter";
import { cross2d, cyclic } from "../../utils/mathutils";
import { ZSCALE } from "../utils";
import { sectorWalls } from "./loops";
import { Board, FACE_SPRITE, Sector, SectorStats, Sprite, SpriteStats, Wall, WallStats } from "./structs";

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

export function clockwise(polygon: Iterable<[number, number]>): boolean {
  let minx = Number.MAX_VALUE;
  let minwall = -1;
  const points = [...polygon];
  const len = points.length;
  for (const [w1, w2] of cyclicPairs(len)) {
    const wall2 = points[w2];
    if (wall2[0] < minx) {
      minx = wall2[0];
      minwall = w1;
    }
  }
  const wall0 = points[minwall];
  const wall1 = points[cyclic(minwall + 1, len)];
  const wall2 = points[cyclic(minwall + 2, len)];

  if (wall2[1] <= wall1[1] && wall1[1] <= wall0[1]) return true;
  if (wall0[1] <= wall1[1] && wall1[1] <= wall2[1]) return false;

  return cross2d(wall0[0] - wall1[0], wall0[1] - wall1[1], wall2[0] - wall1[0], wall2[1] - wall1[1]) < 0;
}

function updateWallIds(afterWallId: number, size: number) {
  return (w: number) => {
    if (size < 0 && w >= afterWallId && w < afterWallId - size) return -1;
    else if (w > afterWallId) return w + size;
    return w;
  }
}

export function moveWalls(board: Board, secId: number, afterWallId: number, size: number, refs: BuildReferenceTracker) {
  if (size == 0) return;
  if (size < 0) iter(range(afterWallId, afterWallId - size)).forEach(w => board.walls[w] = null);

  for (let w = 0; w < board.numwalls; w++) {
    const wall = board.walls[w];
    if (wall == null) continue;
    if (wall.point2 > afterWallId) wall.point2 += size;
    if (wall.nextwall > afterWallId) wall.nextwall += size;
  }

  refs.walls.update(updateWallIds(afterWallId, size));

  if (size > 0) {
    const end = board.numwalls - 1;
    for (let i = end; i > afterWallId; i--) board.walls[i + size] = board.walls[i];
    for (let i = 0; i < size; i++) board.walls[i + afterWallId + 1] = null;
  } else {
    const end = board.numwalls + size;
    for (let i = afterWallId; i < end; i++) board.walls[i] = board.walls[i - size];
    for (let i = 0; i < -size; i++) board.walls[end + i] = null;
  }

  board.numwalls += size;
  board.sectors[secId].wallnum += size;
  for (let i = 0; i < board.numsectors; i++) {
    const sec = board.sectors[i];
    if (sec.wallptr >= afterWallId + 1 && i != secId) sec.wallptr += size;
  }
}

export function resizeWalls(board: Board, sectorId: number, newSize: number, refs: BuildReferenceTracker) {
  const sec = board.sectors[sectorId];
  const dw = newSize - sec.wallnum;
  if (dw == 0) return;
  if (dw > 0) {
    moveWalls(board, sectorId, sec.wallptr + sec.wallnum - 1, dw, refs);
  } else {
    moveWalls(board, sectorId, sec.wallptr + newSize, dw, refs)
  }
}

export function wallInSector(board: Board, sectorId: number, x: number, y: number) {
  return iter(sectorWalls(board, sectorId)).first(w => board.walls[w].x == x && board.walls[w].y == y, -1)
}

export function copyWallStats(stat: WallStats): WallStats {
  let nstat = new WallStats();
  nstat.alignBottom = stat.alignBottom;
  nstat.blocking = stat.blocking;
  nstat.blocking2 = stat.blocking2;
  nstat.masking = stat.masking;
  nstat.oneWay = stat.oneWay;
  nstat.swapBottoms = stat.swapBottoms;
  nstat.translucent = stat.translucent;
  nstat.translucentReversed = stat.translucentReversed;
  nstat.xflip = stat.xflip;
  nstat.yflip = stat.yflip;
  nstat.unk = stat.unk;
  return nstat;
}

export function copyWall(wall: Wall, x: number, y: number): Wall {
  let nwall = new Wall();
  nwall.x = x;
  nwall.y = y;
  nwall.point2 = wall.point2;
  nwall.nextwall = wall.nextwall;
  nwall.nextsector = wall.nextsector;
  nwall.cstat = copyWallStats(wall.cstat);
  nwall.picnum = wall.picnum;
  nwall.overpicnum = wall.overpicnum;
  nwall.shade = wall.shade;
  nwall.pal = wall.pal;
  nwall.xrepeat = wall.xrepeat;
  nwall.yrepeat = wall.yrepeat;
  nwall.xpanning = wall.xpanning;
  nwall.ypanning = wall.ypanning;
  nwall.lotag = wall.lotag;
  nwall.hitag = wall.hitag;
  nwall.extra = wall.extra;
  return nwall;
}

export function newWallStats() {
  let stat = new WallStats();
  stat.alignBottom = 0;
  stat.blocking = 0;
  stat.blocking2 = 0;
  stat.masking = 0;
  stat.oneWay = 0;
  stat.swapBottoms = 0;
  stat.translucent = 0;
  stat.translucentReversed = 0;
  stat.xflip = 0;
  stat.yflip = 0;
  stat.unk = 0;
  return stat;
}

export function newWall(x: number, y: number): Wall {
  let wall = new Wall();
  wall.x = x;
  wall.y = y;
  wall.point2 = -1;
  wall.nextwall = -1;
  wall.nextsector = -1;
  wall.cstat = newWallStats();
  wall.picnum = 0;
  wall.overpicnum = 0;
  wall.shade = 0;
  wall.pal = 0;
  wall.xrepeat = 8;
  wall.yrepeat = 8;
  wall.xpanning = 0;
  wall.ypanning = 0;
  wall.lotag = 0;
  wall.hitag = 0
  wall.extra = 65535;
  return wall;
}

export function copySectorStats(stat: SectorStats): SectorStats {
  let nstat = new SectorStats();
  nstat.alignToFirstWall = stat.alignToFirstWall;
  nstat.doubleSmooshiness = stat.doubleSmooshiness;
  nstat.parallaxing = stat.parallaxing;
  nstat.slopped = stat.slopped;
  nstat.swapXY = stat.swapXY;
  nstat.xflip = stat.xflip;
  nstat.yflip = stat.yflip;
  nstat.unk = stat.unk;
  return nstat;
}

export function copySector(sector: Sector): Sector {
  let nsector = new Sector();
  nsector.ceilingheinum = sector.ceilingheinum;
  nsector.ceilingpal = sector.ceilingpal;
  nsector.ceilingpicnum = sector.ceilingpicnum;
  nsector.ceilingshade = sector.ceilingshade;
  nsector.ceilingstat = copySectorStats(sector.ceilingstat);
  nsector.ceilingxpanning = sector.ceilingxpanning;
  nsector.ceilingypanning = sector.ceilingypanning;
  nsector.ceilingz = sector.ceilingz;
  nsector.extra = sector.extra;
  nsector.floorheinum = sector.floorheinum;
  nsector.floorpal = sector.floorpal;
  nsector.floorpicnum = sector.floorpicnum;
  nsector.floorshade = sector.floorshade;
  nsector.floorstat = copySectorStats(sector.floorstat);
  nsector.floorxpanning = sector.floorxpanning;
  nsector.floorypanning = sector.floorypanning;
  nsector.floorz = sector.floorz;
  nsector.hitag = sector.hitag;
  nsector.lotag = sector.lotag;
  nsector.visibility = sector.visibility;
  nsector.wallnum = 0;
  nsector.wallptr = 0;
  nsector.filler = 0;
  return nsector;
}

export function newSectorStats() {
  let stat = new SectorStats();
  stat.alignToFirstWall = 0;
  stat.doubleSmooshiness = 0;
  stat.parallaxing = 0;
  stat.slopped = 0;
  stat.swapXY = 0;
  stat.xflip = 0;
  stat.yflip = 0;
  stat.unk = 0;
  return stat;
}

export function newSector(): Sector {
  let sector = new Sector();
  sector.ceilingheinum = 0;
  sector.ceilingpal = 0;
  sector.ceilingpicnum = 0;
  sector.ceilingshade = 0;
  sector.ceilingstat = newSectorStats();
  sector.ceilingxpanning = 0;
  sector.ceilingypanning = 0;
  sector.ceilingz = 2048 * ZSCALE;
  sector.extra = 65535;
  sector.floorheinum = 0;
  sector.floorpal = 0;
  sector.floorpicnum = 0;
  sector.floorshade = 0;
  sector.floorstat = newSectorStats();
  sector.floorxpanning = 0;
  sector.floorypanning = 0;
  sector.floorz = 0;
  sector.hitag = 0;
  sector.lotag = 0;
  sector.visibility = 0;
  sector.wallnum = 0;
  sector.wallptr = 0;
  sector.filler = 0;
  return sector;
}

export function newSpriteStats() {
  let stats = new SpriteStats();
  stats.blocking = 0;
  stats.blocking2 = 0;
  stats.invisible = 0;
  stats.noautoshading = 0;
  stats.onesided = 0;
  stats.realCenter = 0;
  stats.tranclucentReversed = 0;
  stats.translucent = 0;
  stats.type = FACE_SPRITE;
  stats.xflip = 0;
  stats.yflip = 0;
  stats.unk = 0;
  return stats;
}

export function newSprite(x: number, y: number, z: number): Sprite {
  let sprite = new Sprite();
  sprite.ang = 0;
  sprite.clipdist = 0;
  sprite.cstat = newSpriteStats();
  sprite.extra = 65535;
  sprite.hitag = 0;
  sprite.lotag = 0;
  sprite.owner = -1;
  sprite.pal = 0;
  sprite.picnum = 1;
  sprite.sectnum = -1;
  sprite.shade = 0;
  sprite.statnum = 0;
  sprite.x = x;
  sprite.y = y;
  sprite.z = z;
  sprite.xoffset = 0;
  sprite.yoffset = 0;
  sprite.xvel = 0;
  sprite.yvel = 0;
  sprite.xrepeat = 64;
  sprite.yrepeat = 64;
  sprite.filler = 0;
  return sprite;
}

export function copySpriteStats(stats: SpriteStats) {
  let nstats = new SpriteStats();
  nstats.blocking = stats.blocking;
  nstats.blocking2 = stats.blocking2;
  nstats.invisible = stats.invisible;
  nstats.noautoshading = stats.noautoshading;
  nstats.onesided = stats.onesided;
  nstats.realCenter = stats.realCenter;
  nstats.tranclucentReversed = stats.tranclucentReversed;
  nstats.translucent = stats.translucent;
  nstats.type = stats.type;
  nstats.xflip = stats.xflip;
  nstats.yflip = stats.yflip;
  stats.unk = stats.unk;
  return nstats;
}

export function copySprite(sprite: Sprite, x: number, y: number, z: number): Sprite {
  let nsprite = new Sprite();
  nsprite.ang = sprite.ang;
  nsprite.clipdist = sprite.clipdist;
  nsprite.extra = sprite.extra;
  nsprite.hitag = sprite.hitag;
  nsprite.lotag = sprite.lotag;
  nsprite.owner = sprite.owner;
  nsprite.pal = sprite.pal;
  nsprite.picnum = sprite.picnum;
  nsprite.sectnum = sprite.sectnum;
  nsprite.shade = sprite.shade;
  nsprite.statnum = sprite.statnum;
  nsprite.x = x;
  nsprite.y = y;
  nsprite.z = z;
  nsprite.xoffset = sprite.xoffset;
  nsprite.yoffset = sprite.yoffset;
  nsprite.xvel = sprite.xvel;
  nsprite.yvel = sprite.yvel;
  nsprite.xrepeat = sprite.xrepeat;
  nsprite.yrepeat = sprite.yrepeat;
  nsprite.cstat = copySpriteStats(sprite.cstat);
  return nsprite;
}

export function* createNewWalls(points: Iterable<[number, number]>, matchWalls: [number, number][], commonWall: Wall, board: Board): Generator<Wall> {
  for (const [p, i] of enumerate(points)) {
    const matchWall = matchWalls[i];
    const baseWall = matchWall == null ? commonWall : board.walls[matchWall[1]];
    const wall = copyWall(baseWall, p[0], p[1]);
    if (matchWall != null) {
      wall.nextwall = matchWall[1];
      wall.nextsector = matchWall[0];
    } else {
      wall.nextwall = -1;
      wall.nextsector = -1;
    }
    yield wall;
  }
}

export function addSector(board: Board, sector: Sector) {
  const idx = board.numsectors;
  board.sectors[idx] = sector;
  sector.wallptr = board.numwalls;
  board.numsectors++;
  return idx;
}