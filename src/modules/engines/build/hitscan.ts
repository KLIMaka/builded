import { cross2d, dot2d, int, len2d, sign, sqrLen2d } from "../../../libs/mathutils";
import { Deck, IndexedDeck, range } from "../../collections";
import { Target } from "./api";
import { ArtInfo, ArtInfoProvider } from "./art";
import { Board, FACE_SPRITE, FLOOR_SPRITE, Sector, WALL_SPRITE } from "./structs";
import { ANGSCALE, groupSprites, inPolygon, inSector, rayIntersect, slope, spriteAngle, ZSCALE } from "./utils";
import { vec3, Vec3Array } from "../../../libs_js/glmatrix";

export enum EntityType {
  FLOOR, CEILING, UPPER_WALL, MID_WALL, LOWER_WALL, SPRITE, WALL_POINT
}

export class Entity {
  constructor(
    readonly id: number,
    readonly type: EntityType
  ) { }

  isWall() { return isWall(this.type) }
  isSector() { return isSector(this.type) }
  isSprite() { return isSprite(this.type) }
  clone() { return new Entity(this.id, this.type) }
}

export function isSector(type: EntityType) {
  switch (type) {
    case EntityType.FLOOR:
    case EntityType.CEILING:
      return true;
    default: return false;
  }
}

export function isWall(type: EntityType) {
  switch (type) {
    case EntityType.LOWER_WALL:
    case EntityType.MID_WALL:
    case EntityType.UPPER_WALL:
    case EntityType.WALL_POINT:
      return true;
    default: return false;
  }
}

export function isSprite(type: EntityType) {
  return type == EntityType.SPRITE;
}

export class Ray {
  public start = vec3.create();
  public dir = vec3.create();
}

const SPRITE_OFF = 0.1;

export function pointOnRay(out: Vec3Array, ray: Ray, t: number) {
  vec3.copy(out, ray.dir);
  vec3.scale(out, out, t);
  vec3.add(out, out, ray.start);
  return out;
}

export class Hitscan implements Target {
  constructor(
    public t: number = -1,
    public ent: Entity = null,
    public ray = new Ray(),
    private targetPoint = vec3.create()) { }

  public reset(xs: number, ys: number, zs: number, vx: number, vy: number, vz: number) {
    this.ent = null;
    this.t = -1;
    vec3.set(this.ray.start, xs, ys, zs);
    vec3.set(this.ray.dir, vx, vy, vz);
  }

  private testHit(t: number): boolean {
    if (this.t == -1 || this.t >= t) {
      this.t = t;
      return true;
    }
    return false;
  }

  public hit(t: number, id: number, type: EntityType) {
    if (this.testHit(t)) {
      this.ent = new Entity(id, type)
    }
  }

  private target(): Vec3Array {
    return this.t == -1
      ? vec3.copy(this.targetPoint, this.ray.start)
      : pointOnRay(this.targetPoint, this.ray, this.t);
  }

  get coords() { return <[number, number, number]>this.target() }
  get entity() { return this.ent }
}

let hitPoint = vec3.create();
function hitSector(board: Board, secId: number, t: number, hit: Hitscan, type: EntityType) {
  pointOnRay(hitPoint, hit.ray, t);
  let x = int(hitPoint[0]);
  let y = int(hitPoint[1]);
  if (inSector(board, x, y, secId))
    hit.hit(t, secId, type);
}

function intersectSectorPlanes(board: Board, sec: Sector, secId: number, hit: Hitscan) {
  let wall1 = board.walls[sec.wallptr]
  let wall2 = board.walls[wall1.point2];
  let dx = wall2.x - wall1.x;
  let dy = wall2.y - wall1.y;
  let dl = len2d(dx, dy);
  if (dl == 0) return;
  let ndx = dx / dl;
  let ndy = dy / dl;
  let angk = -cross2d(ndx, ndy, hit.ray.dir[0], hit.ray.dir[1]);

  let ceilk = sec.ceilingheinum * ANGSCALE * angk;
  let dk = hit.ray.dir[2] / ZSCALE - ceilk;
  if (dk > 0) {
    let ceilz = slope(board, secId, hit.ray.start[0], hit.ray.start[1], sec.ceilingheinum) + sec.ceilingz;
    let ceildz = (ceilz - hit.ray.start[2]) / ZSCALE;
    let t = ceildz / dk;
    hitSector(board, secId, t, hit, EntityType.CEILING);
  }

  let floork = sec.floorheinum * ANGSCALE * angk;
  let dk1 = floork - hit.ray.dir[2] / ZSCALE;
  if (dk1 > 0) {
    let floorz = slope(board, secId, hit.ray.start[0], hit.ray.start[1], sec.floorheinum) + sec.floorz;
    let floordz = (hit.ray.start[2] - floorz) / ZSCALE;
    let t = floordz / dk1;
    hitSector(board, secId, t, hit, EntityType.FLOOR);
  }
}

function intersectWall(board: Board, wallId: number, hit: Hitscan): number {
  let wall = board.walls[wallId];
  let wall2 = board.walls[wall.point2];
  let x1 = wall.x, y1 = wall.y;
  let x2 = wall2.x, y2 = wall2.y;
  let [xs, ys, zs] = hit.ray.start;
  let [vx, vy, vz] = hit.ray.dir;

  if (cross2d(x1 - xs, y1 - ys, x2 - xs, y2 - ys) <= 0) return -1;

  let intersect = rayIntersect(xs, ys, zs, vx, vy, vz, x1, y1, x2, y2);
  if (intersect == null) return -1;
  let [ix, iy, iz, it] = intersect;

  let nextsecId = wall.nextsector;
  if (nextsecId == -1) {
    hit.hit(it, wallId, EntityType.MID_WALL);
    return -1;
  }

  let nextsec = board.sectors[nextsecId];
  let floorz = slope(board, nextsecId, ix, iy, nextsec.floorheinum) + nextsec.floorz;
  let ceilz = slope(board, nextsecId, ix, iy, nextsec.ceilingheinum) + nextsec.ceilingz;
  if (iz <= ceilz) {
    hit.hit(it, wallId, EntityType.UPPER_WALL);
    return -1;
  } else if (iz >= floorz) {
    hit.hit(it, wallId, EntityType.LOWER_WALL);
    return -1;
  } else if (wall.cstat.masking) {
    hit.hit(it, wallId, EntityType.MID_WALL);
    return -1;
  }

  return nextsecId;
}

function intersectFaceSprite(board: Board, info: ArtInfo, sprId: number, hit: Hitscan) {
  let [xs, ys, zs] = hit.ray.start;
  let [vx, vy, vz] = hit.ray.dir;
  if (vx == 0 && vy == 0) return;
  let spr = board.sprites[sprId];
  let x = spr.x, y = spr.y, z = spr.z;
  let dx = x - xs; let dy = y - ys;
  let vl = sqrLen2d(vx, vy);
  let t = dot2d(vx, vy, dx, dy) / vl;
  if (t <= 0) return;
  let intz = zs + int(vz * t);
  let h = info.h * (spr.yrepeat << 2);
  z += spr.cstat.realCenter ? h >> 1 : 0;
  z -= info.attrs.yoff * (spr.yrepeat << 2);
  if ((intz > z) || (intz < z - h)) return;
  let intx = xs + int(vx * t);
  let inty = ys + int(vy * t);
  let w = info.w * (spr.xrepeat >> 2);
  if (len2d(x - intx, y - inty) > (w >> 1)) return;
  hit.hit(t, sprId, EntityType.SPRITE);
}

function intersectWallSprite(board: Board, info: ArtInfo, sprId: number, hit: Hitscan) {
  let [xs, ys, zs] = hit.ray.start;
  let [vx, vy, vz] = hit.ray.dir;
  if (vx == 0 && vy == 0) return;
  let spr = board.sprites[sprId];
  let x = spr.x, y = spr.y, z = spr.z;
  let ang = spriteAngle(spr.ang);
  let dx = Math.sin(ang) * (spr.xrepeat >> 2);
  let dy = Math.cos(ang) * (spr.xrepeat >> 2);
  let w = info.w;
  let xoff = info.attrs.xoff + spr.xoffset;
  if (spr.cstat.xflip) xoff = -xoff;
  let hw = (w >> 1) + xoff;
  let x1 = x - dx * hw; let y1 = y - dy * hw;
  let x2 = x1 + dx * w; let y2 = y1 + dy * w;
  if (spr.cstat.onesided && cross2d(x1 - xs, y1 - ys, x2 - xs, y2 - ys) > 0) return;
  let intersect = rayIntersect(xs, ys, zs, vx, vy, vz, x1, y1, x2, y2);
  if (intersect == null) return;
  let [, , iz, it] = intersect;
  let h = info.h * (spr.yrepeat << 2);
  z += spr.cstat.realCenter ? h >> 1 : 0;
  z -= info.attrs.yoff * (spr.yrepeat << 2);
  if ((iz > z) || (iz < z - h)) return;
  hit.hit(it - SPRITE_OFF, sprId, EntityType.SPRITE);
}

let xss = new Deck<number>();
let yss = new Deck<number>();
function intersectFloorSprite(board: Board, info: ArtInfo, sprId: number, hit: Hitscan) {
  let [xs, ys, zs] = hit.ray.start;
  let [vx, vy, vz] = hit.ray.dir;
  if (vz == 0) return;
  let spr = board.sprites[sprId];
  let x = spr.x, y = spr.y, z = spr.z;
  let dz = z - zs;
  if (sign(dz) != sign(vz)) return;
  if (spr.cstat.onesided && (spr.cstat.yflip == 1) == zs < z) return;

  let xoff = 0;//(info.attrs.xoff + spr.xoffset) * (spr.cstat.xflip ? -1 : 1);
  let yoff = 0;//(info.attrs.yoff + spr.yoffset) * (spr.cstat.yflip ? -1 : 1);
  let ang = spriteAngle(spr.ang);
  let cosang = Math.cos(ang);
  let sinang = Math.sin(ang);
  let dx = ((info.w >> 1) + xoff) * (spr.xrepeat >> 2);
  let dy = ((info.h >> 1) + yoff) * (spr.yrepeat >> 2);
  let dw = info.w * (spr.xrepeat >> 2);
  let dh = info.h * (spr.yrepeat >> 2);

  let x1 = int(x + sinang * dx + cosang * dy);
  let y1 = int(y + sinang * dy - cosang * dx);
  let x2 = int(x1 - sinang * dw);
  let y2 = int(y1 + cosang * dw);
  let x3 = int(x2 - cosang * dh);
  let y3 = int(y2 - sinang * dh);
  let x4 = int(x1 - cosang * dh);
  let y4 = int(y1 - sinang * dh);
  xss.clear().push(x1).push(x2).push(x3).push(x4);
  yss.clear().push(y1).push(y2).push(y3).push(y4);

  let t = dz / vz;
  let ix = xs + int(vx * t);
  let iy = ys + int(vy * t);
  if (!inPolygon(ix, iy, xss, yss)) return;
  hit.hit(t - SPRITE_OFF, sprId, EntityType.SPRITE);
}


function intersectSprite(board: Board, artInfo: ArtInfoProvider, sprId: number, hit: Hitscan) {
  let spr = board.sprites[sprId];
  if (spr.picnum == 0 || spr.cstat.invisible) return;
  let info = artInfo.getInfo(spr.picnum);
  if (spr.cstat.type == FACE_SPRITE) {
    intersectFaceSprite(board, info, sprId, hit);
  } else if (spr.cstat.type == WALL_SPRITE) {
    intersectWallSprite(board, info, sprId, hit);
  } else if (spr.cstat.type == FLOOR_SPRITE) {
    intersectFloorSprite(board, info, sprId, hit);
  }
}

function resetStack(board: Board, sectorId: number, stack: IndexedDeck<number>): void {
  stack.clear();
  if (sectorId == -1 || !board.sectors[sectorId]) for (let i of range(0, board.numsectors - 1)) stack.push(i);
  else stack.push(sectorId);
}

let stack = new IndexedDeck<number>();
export function hitscan(board: Board, artInfo: ArtInfoProvider, xs: number, ys: number, zs: number, secId: number, vx: number, vy: number, vz: number, hit: Hitscan, cliptype: number) {
  hit.reset(xs, ys, zs, vx, vy, vz);

  resetStack(board, secId, stack);
  let sprites = groupSprites(board);
  for (let i = 0; i < stack.length(); i++) {
    let s = stack.get(i);
    let sec = board.sectors[s];
    intersectSectorPlanes(board, sec, s, hit);

    let endwall = sec.wallptr + sec.wallnum;
    for (let w = sec.wallptr; w < endwall; w++) {
      let nextsec = intersectWall(board, w, hit);
      if (nextsec != -1 && stack.indexOf(nextsec) == -1) {
        stack.push(nextsec);
      }
    }

    let sprs = sprites[s];
    if (sprs == undefined) continue;
    for (let j = 0; j < sprs.length; j++) {
      intersectSprite(board, artInfo, sprs[j], hit);
    }
  }
}
