import { BoardUtils } from "app/apis/app";
import { vec3, Vec3Array } from "../libs_js/glmatrix";
import { range, wrap } from "../utils/collections";
import { cross2d, dot2d, int, len2d, sign, sqrLen2d } from "../utils/mathutils";
import { inSector, isValidSectorId } from "./board/query";
import { Board, FACE_SPRITE, FLOOR_SPRITE, Sector, WALL_SPRITE } from "./board/structs";
import { ArtInfo, ArtInfoProvider } from "./formats/art";
import { ANGSCALE, inPolygon, rayIntersect, slope, spriteAngle, ZSCALE } from "./utils";

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
  equals(ent: Entity) { return ent == null ? false : ent == this ? true : ent.id == this.id && ent.type == this.type }
}

export interface Target {
  readonly coords: [number, number, number];
  readonly entity: Entity;
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

const hitPoint = vec3.create();
function hitSector(board: Board, secId: number, t: number, hit: Hitscan, type: EntityType) {
  pointOnRay(hitPoint, hit.ray, t);
  const x = int(hitPoint[0]);
  const y = int(hitPoint[1]);
  if (inSector(board, x, y, secId)) hit.hit(t, secId, type);
}

function hitSector3dFloor(board: Board, tdfsector: number, secId: number, t: number, hit: Hitscan, type: EntityType) {
  pointOnRay(hitPoint, hit.ray, t);
  const x = int(hitPoint[0]);
  const y = int(hitPoint[1]);
  if (inSector(board, x, y, secId)) hit.hit(t, tdfsector, type);
}

function intersectPlane(x1: number, y1: number, x2: number, y2: number, planez: number, heighnum: number, hit: Hitscan, ceil: boolean) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dl = len2d(dx, dy);
  const dxn = dl == 0 ? 0 : dx / dl;
  const dyn = dl == 0 ? 0 : dy / dl;
  const rdx = hit.ray.dir[0];
  const rdy = hit.ray.dir[1];
  const angk = -cross2d(dxn, dyn, rdx, rdy);
  const k = heighnum * ANGSCALE * angk;
  const rdz = hit.ray.dir[2] / ZSCALE;
  const mult = ceil ? 1 : -1;
  const dk = (rdz - k) * mult;
  if (dk > 0) {
    const dx1 = hit.ray.start[0] - x1;
    const dy1 = hit.ray.start[1] - y1;
    const k1 = -cross2d(dxn, dyn, dx1, dy1);
    const z = heighnum * ANGSCALE * k1 * ZSCALE + planez;
    const rsz = hit.ray.start[2];
    const dz = (z - rsz) * mult / ZSCALE;
    return dz / dk;
  }
  return -1;
}

function intersectSectorPlanes(board: Board, sec: Sector, secId: number, hit: Hitscan) {
  const wall1 = board.walls[sec.wallptr]
  const wall2 = board.walls[wall1.point2];
  const ceilt = intersectPlane(wall1.x, wall1.y, wall2.x, wall2.y, sec.ceilingz, sec.ceilingheinum, hit, true);
  if (ceilt != -1) hitSector(board, secId, ceilt, hit, EntityType.CEILING);
  const floort = intersectPlane(wall1.x, wall1.y, wall2.x, wall2.y, sec.floorz, sec.floorheinum, hit, false);
  if (floort != -1) hitSector(board, secId, floort, hit, EntityType.FLOOR);

  if (sec.lotag == 32 && isValidSectorId(board, sec.hitag)) {
    const tds = board.sectors[sec.hitag];
    const ceilt = intersectPlane(wall1.x, wall1.y, wall2.x, wall2.y, tds.ceilingz, tds.ceilingheinum, hit, false);
    if (ceilt != -1) hitSector3dFloor(board, sec.hitag, secId, ceilt, hit, EntityType.CEILING);
    const floort = intersectPlane(wall1.x, wall1.y, wall2.x, wall2.y, tds.floorz, tds.floorheinum, hit, true);
    if (floort != -1) hitSector3dFloor(board, sec.hitag, secId, floort, hit, EntityType.FLOOR);
  }
}

function intersectWall(board: Board, wallId: number, hit: Hitscan): number {
  const wall = board.walls[wallId];
  const wall2 = board.walls[wall.point2];
  const x1 = wall.x, y1 = wall.y;
  const x2 = wall2.x, y2 = wall2.y;
  const [xs, ys, zs] = hit.ray.start;
  const [vx, vy, vz] = hit.ray.dir;

  if (cross2d(x1 - xs, y1 - ys, x2 - xs, y2 - ys) <= 0) return -1;

  const intersect = rayIntersect(xs, ys, zs, vx, vy, vz, x1, y1, x2, y2);
  if (intersect == null) return -1;
  const [ix, iy, iz, it] = intersect;

  const nextsecId = wall.nextsector;
  if (nextsecId == -1) {
    hit.hit(it, wallId, EntityType.MID_WALL);
    return -1;
  }

  const nextsec = board.sectors[nextsecId];
  const floorz = slope(board, nextsecId, ix, iy, nextsec.floorheinum) + nextsec.floorz;
  const ceilz = slope(board, nextsecId, ix, iy, nextsec.ceilingheinum) + nextsec.ceilingz;
  const nextwall = board.walls[wall.nextwall];
  if (iz <= ceilz) {
    hit.hit(it, wallId, EntityType.UPPER_WALL);
    return -1;
  } else if (iz >= floorz) {
    hit.hit(it, wallId, EntityType.LOWER_WALL);
    return -1;
  } else if (wall.cstat.masking || nextwall.cstat.masking || wall.cstat.oneWay) {
    hit.hit(it, wallId, EntityType.MID_WALL);
    return -1;
  }

  if (nextsec.lotag == 32 && isValidSectorId(board, nextsec.hitag)) {
    const tds = board.sectors[nextsec.hitag];
    const floorz = slope(board, nextsecId, ix, iy, tds.floorheinum) + tds.floorz;
    const ceilz = slope(board, nextsecId, ix, iy, tds.ceilingheinum) + tds.ceilingz;
    if (iz >= ceilz && iz <= floorz) {
      hit.hit(it, tds.wallptr, EntityType.MID_WALL);
      return -1;
    }
  }

  return nextsecId;
}

function intersectFaceSprite(board: Board, info: ArtInfo, sprId: number, hit: Hitscan) {
  const [xs, ys, zs] = hit.ray.start;
  const [vx, vy, vz] = hit.ray.dir;
  if (vx == 0 && vy == 0) return;
  const spr = board.sprites[sprId];
  const x = spr.x, y = spr.y;
  let z = spr.z;
  const dx = x - xs; const dy = y - ys;
  const vl = sqrLen2d(vx, vy);
  const t = dot2d(vx, vy, dx, dy) / vl;
  if (t <= 0) return;
  const intz = zs + int(vz * t);
  const h = info.h * (spr.yrepeat << 2);
  z += spr.cstat.realCenter ? h >> 1 : 0;
  z -= info.attrs.yoff * (spr.yrepeat << 2);
  if ((intz > z) || (intz < z - h)) return;
  const intx = xs + int(vx * t);
  const inty = ys + int(vy * t);
  const w = info.w * (spr.xrepeat >> 2);
  if (len2d(x - intx, y - inty) > (w >> 1)) return;
  hit.hit(t, sprId, EntityType.SPRITE);
}

function intersectWallSprite(board: Board, info: ArtInfo, sprId: number, hit: Hitscan) {
  const [xs, ys, zs] = hit.ray.start;
  const [vx, vy, vz] = hit.ray.dir;
  if (vx == 0 && vy == 0) return;
  const spr = board.sprites[sprId];
  const x = spr.x, y = spr.y
  let z = spr.z;
  const ang = spriteAngle(spr.ang);
  const dx = Math.sin(ang) * (spr.xrepeat >> 2);
  const dy = Math.cos(ang) * (spr.xrepeat >> 2);
  const w = info.w;
  let xoff = info.attrs.xoff + spr.xoffset;
  if (spr.cstat.xflip) xoff = -xoff;
  const hw = (w >> 1) + xoff;
  const x1 = x - dx * hw; const y1 = y - dy * hw;
  const x2 = x1 + dx * w; const y2 = y1 + dy * w;
  if (spr.cstat.onesided && cross2d(x1 - xs, y1 - ys, x2 - xs, y2 - ys) > 0) return;
  const intersect = rayIntersect(xs, ys, zs, vx, vy, vz, x1, y1, x2, y2);
  if (intersect == null) return;
  const [, , iz, it] = intersect;
  const h = info.h * (spr.yrepeat << 2);
  z += spr.cstat.realCenter ? h >> 1 : 0;
  z -= info.attrs.yoff * (spr.yrepeat << 2);
  if ((iz > z) || (iz < z - h)) return;
  hit.hit(it - SPRITE_OFF, sprId, EntityType.SPRITE);
}

const points_ = wrap(<[number, number][]>[[0, 0], [0, 0], [0, 0], [0, 0]]);
function points(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number) {
  points_.get(0)[0] = x1;
  points_.get(0)[1] = y1;
  points_.get(1)[0] = x2;
  points_.get(1)[1] = y2;
  points_.get(2)[0] = x3;
  points_.get(2)[1] = y3;
  points_.get(3)[0] = x4;
  points_.get(3)[1] = y4;
  return points_;
}

function intersectFloorSprite(board: Board, info: ArtInfo, sprId: number, hit: Hitscan) {
  const [xs, ys, zs] = hit.ray.start;
  const [vx, vy, vz] = hit.ray.dir;
  if (vz == 0) return;
  const spr = board.sprites[sprId];
  const x = spr.x, y = spr.y, z = spr.z;
  const dz = z - zs;
  if (sign(dz) != sign(vz)) return;
  if (spr.cstat.onesided && (spr.cstat.yflip == 1) == zs < z) return;

  const xoff = 0;//(info.attrs.xoff + spr.xoffset) * (spr.cstat.xflip ? -1 : 1);
  const yoff = 0;//(info.attrs.yoff + spr.yoffset) * (spr.cstat.yflip ? -1 : 1);
  const ang = spriteAngle(spr.ang);
  const cosang = Math.cos(ang);
  const sinang = Math.sin(ang);
  const dx = ((info.w >> 1) + xoff) * (spr.xrepeat >> 2);
  const dy = ((info.h >> 1) + yoff) * (spr.yrepeat >> 2);
  const dw = info.w * (spr.xrepeat >> 2);
  const dh = info.h * (spr.yrepeat >> 2);

  const x1 = int(x + sinang * dx + cosang * dy);
  const y1 = int(y + sinang * dy - cosang * dx);
  const x2 = int(x1 - sinang * dw);
  const y2 = int(y1 + cosang * dw);
  const x3 = int(x2 - cosang * dh);
  const y3 = int(y2 - sinang * dh);
  const x4 = int(x1 - cosang * dh);
  const y4 = int(y1 - sinang * dh);

  const t = dz / vz;
  const ix = xs + int(vx * t);
  const iy = ys + int(vy * t);
  if (!inPolygon(ix, iy, points(x1, y1, x2, y2, x3, y3, x4, y4))) return;
  hit.hit(t - SPRITE_OFF, sprId, EntityType.SPRITE);
}


function intersectSprite(board: Board, artInfo: ArtInfoProvider, sprId: number, hit: Hitscan) {
  const spr = board.sprites[sprId];
  if (spr.picnum == 0 || spr.cstat.invisible) return;
  const info = artInfo.getInfo(spr.picnum);
  if (spr.cstat.type == FACE_SPRITE) {
    intersectFaceSprite(board, info, sprId, hit);
  } else if (spr.cstat.type == WALL_SPRITE) {
    intersectWallSprite(board, info, sprId, hit);
  } else if (spr.cstat.type == FLOOR_SPRITE) {
    intersectFloorSprite(board, info, sprId, hit);
  }
}

function resetStack(board: Board, sectorId: number): Set<number> {
  if (sectorId == -1 || !board.sectors[sectorId]) return new Set(range(0, board.numsectors));
  else return new Set([sectorId]);
}

export function hitscan(board: Board, boardUtils: BoardUtils, artInfo: ArtInfoProvider, xs: number, ys: number, zs: number, secId: number, vx: number, vy: number, vz: number, hit: Hitscan, cliptype: number) {
  hit.reset(xs, ys, zs, vx, vy, vz);

  const stack = resetStack(board, secId);
  for (const s of stack) {
    const sec = board.sectors[s];
    intersectSectorPlanes(board, sec, s, hit);

    const endwall = sec.wallptr + sec.wallnum;
    for (let w = sec.wallptr; w < endwall; w++) {
      const nextsec = intersectWall(board, w, hit);
      if (nextsec != -1 && !stack.has(nextsec)) {
        stack.add(nextsec);
      }
    }

    if (cliptype == 1) continue;
    const sprs = boardUtils.spritesBySector(s);
    if (sprs == undefined) continue;
    for (let j = 0; j < sprs.length; j++) {
      intersectSprite(board, artInfo, sprs[j], hit);
    }
  }
}
