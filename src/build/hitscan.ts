import { BoardUtils } from "app/apis/app";
import { vec3 } from "gl-matrix";
import { range } from "../utils/collections";
import { SortedHeap } from "../utils/list";
import { cross2d, int, len2d, ortonorm2d, sign } from "../utils/mathutils";
import { inSector, isValidSectorId } from "./board/query";
import { Board, FACE_SPRITE, FLOOR_SPRITE, Sector, WALL_SPRITE } from "./board/structs";
import { ArtInfoProvider } from "./formats/art";
import { SpriteInfo, floorSprite, spriteInfo, wallSprite } from "./sprites";
import { ANGSCALE, ZSCALE, inPolygon, rayIntersect, slope } from "./utils";

export enum EntityType {
  FLOOR, CEILING, UPPER_WALL, MID_WALL, LOWER_WALL, SPRITE, WALL_POINT
}

export class Entity {
  static of(id: number, type: EntityType) { return new Entity(id, type) }
  static floor(id: number) { return Entity.of(id, EntityType.FLOOR) }
  static ceiling(id: number) { return Entity.of(id, EntityType.CEILING) }
  static upperWal(id: number) { return Entity.of(id, EntityType.UPPER_WALL) }
  static midWall(id: number) { return Entity.of(id, EntityType.MID_WALL) }
  static lowerWall(id: number) { return Entity.of(id, EntityType.LOWER_WALL) }
  static sprite(id: number) { return Entity.of(id, EntityType.SPRITE) }
  static wallPoint(id: number) { return Entity.of(id, EntityType.WALL_POINT) }

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
  readonly coords: vec3;
  readonly entity: Entity;
}
export const EMPTY_TARGET: Target = { coords: vec3.create(), entity: null };

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

export function pointOnRay(out: vec3, ray: Ray, t: number) {
  vec3.copy(out, ray.dir);
  vec3.scale(out, out, t);
  vec3.add(out, out, ray.start);
  return out;
}

const EMPTY: Target = { entity: null, coords: [0, 0, 0] };

export class Hitscan {
  constructor(
    private targetsList = new SortedHeap<Target>(),
    public ray = new Ray(),
    public forward = vec3.create()
  ) { }

  public reset(xs: number, ys: number, zs: number, vx: number, vy: number, vz: number, fx = vx, fy = vy, fz = vz) {
    this.targetsList.clear();
    this.targetsList.add(EMPTY, Number.MAX_VALUE);
    vec3.set(this.ray.start, xs, ys, zs);
    vec3.set(this.ray.dir, vx, vy, vz);
    vec3.set(this.forward, fx, fy, fz);
  }

  public hit(t: number, id: number, type: EntityType, x: number, y: number, z: number) {
    const target = { entity: new Entity(id, type), coords: [x, y, z] } as Target;
    this.targetsList.add(target, t);
  }

  isEmpty(): boolean { return this.targetsList.isEmpty() }
  target() { return this.targetsList.first() }
  targets(): Iterable<Target> { return this.targetsList.get() }
}

const hitPoint = vec3.create();
function hitSector(board: Board, secId: number, t: number, hit: Hitscan, type: EntityType) {
  pointOnRay(hitPoint, hit.ray, t);
  const x = int(hitPoint[0]);
  const y = int(hitPoint[1]);
  const z = int(hitPoint[2]);
  if (inSector(board, x, y, secId)) hit.hit(t, secId, type, x, y, z);
}

function hitSector3dFloor(board: Board, tdfsector: number, secId: number, t: number, hit: Hitscan, type: EntityType) {
  pointOnRay(hitPoint, hit.ray, t);
  const x = int(hitPoint[0]);
  const y = int(hitPoint[1]);
  const z = int(hitPoint[2]);
  if (inSector(board, x, y, secId)) hit.hit(t, tdfsector, type, x, y, z);
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
  const x1 = wall.x;
  const y1 = wall.y;
  const x2 = wall2.x;
  const y2 = wall2.y;
  const [xs, ys, zs] = hit.ray.start;
  const [vx, vy, vz] = hit.ray.dir;

  if (cross2d(x1 - xs, y1 - ys, x2 - xs, y2 - ys) <= 0) return -1;

  const intersect = rayIntersect(xs, ys, zs, vx, vy, vz, x1, y1, x2, y2);
  if (intersect == null) return -1;
  const [ix, iy, iz, it] = intersect;

  const nextsecId = wall.nextsector;
  if (nextsecId == -1) {
    hit.hit(it, wallId, EntityType.MID_WALL, ix, iy, iz);
    return -1;
  }

  const nextsec = board.sectors[nextsecId];
  const floorz = slope(board, nextsecId, ix, iy, nextsec.floorheinum) + nextsec.floorz;
  const ceilz = slope(board, nextsecId, ix, iy, nextsec.ceilingheinum) + nextsec.ceilingz;
  if (iz <= ceilz) {
    hit.hit(it, wallId, EntityType.UPPER_WALL, ix, iy, iz);
    return -1;
  } else if (iz >= floorz) {
    hit.hit(it, wallId, EntityType.LOWER_WALL, ix, iy, iz);
    return -1;
  } else if (wall.cstat.masking || wall.cstat.oneWay) {
    hit.hit(it, wallId, EntityType.MID_WALL, ix, iy, iz);
    return -1;
  }

  if (nextsec.lotag == 32 && isValidSectorId(board, nextsec.hitag)) {
    const tds = board.sectors[nextsec.hitag];
    const floorz = slope(board, nextsecId, ix, iy, tds.floorheinum) + tds.floorz;
    const ceilz = slope(board, nextsecId, ix, iy, tds.ceilingheinum) + tds.ceilingz;
    if (iz >= ceilz && iz <= floorz) {
      hit.hit(it, tds.wallptr, EntityType.MID_WALL, ix, iy, iz);
      return -1;
    }
  }

  return nextsecId;
}

function intersectFaceSprite(sprId: number, sinfo: SpriteInfo, hit: Hitscan) {
  const [xs, ys, zs] = hit.ray.start;
  const [vx, vy, vz] = hit.ray.dir;
  const [fx, fy, fz] = hit.forward;
  if (vx == 0 && vy == 0) return;

  const [ofx, ofy] = ortonorm2d(fx, fy);
  const p1 = -sinfo.hw - sinfo.xo;
  const p2 = sinfo.hw - sinfo.xo;
  const x1 = sinfo.x + ofx * p1;
  const y1 = sinfo.y + ofy * p1;
  const x2 = sinfo.x + ofx * p2;
  const y2 = sinfo.y + ofy * p2;

  const inter = rayIntersect(xs, ys, zs / ZSCALE, vx, vy, vz / ZSCALE, x1, y1, x2, y2);
  if (inter == null) return;
  const [ix, iy, iz, it] = inter;
  if ((iz > sinfo.z + sinfo.hh + sinfo.yo) || (iz < sinfo.z - sinfo.hh + sinfo.yo)) return;
  hit.hit(it, sprId, EntityType.SPRITE, ix, iy, iz * ZSCALE);
}

function intersectWallSprite(board: Board, sprId: number, sinfo: SpriteInfo, hit: Hitscan) {
  const [xs, ys, zs] = hit.ray.start;
  const [vx, vy, vz] = hit.ray.dir;
  const spr = board.sprites[sprId];
  const sprite = wallSprite(sinfo);
  if (spr.cstat.onesided && cross2d(sprite.x1 - xs, sprite.y1 - ys, sprite.x2 - xs, sprite.y2 - ys) < 0) return;
  const intersect = rayIntersect(xs, ys, zs / ZSCALE, vx, vy, vz / ZSCALE, sprite.x1, sprite.y1, sprite.x2, sprite.y2);
  if (intersect == null) return;
  const [ix, iy, iz, it] = intersect;
  if ((iz > sprite.ztop) || (iz < sprite.zbottom)) return;
  hit.hit(it - SPRITE_OFF, sprId, EntityType.SPRITE, ix, iy, iz * ZSCALE);
}

const arr: [number, number][] = [[0, 0], [0, 0], [0, 0], [0, 0]];
function points(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number) {
  arr[0][0] = x1;
  arr[0][1] = y1;
  arr[1][0] = x2;
  arr[1][1] = y2;
  arr[2][0] = x3;
  arr[2][1] = y3;
  arr[3][0] = x4;
  arr[3][1] = y4;
  return arr;
}

function intersectFloorSprite(sprId: number, sinfo: SpriteInfo, hit: Hitscan) {
  const [xs, ys, zs] = hit.ray.start;
  const [vx, vy, vz] = hit.ray.dir;
  if (vz == 0) return;
  const zss = zs / ZSCALE;
  const vzs = vz / ZSCALE;
  if (sinfo.onesided && !sinfo.yf && vzs > 0) return;
  if (sinfo.onesided && sinfo.yf && vzs < 0) return;
  const dz = sinfo.z - zss;
  if (sign(dz) != sign(vzs)) return;
  const t = dz / vzs;
  const ix = xs + int(vx * t);
  const iy = ys + int(vy * t);
  const sprite = floorSprite(sinfo);
  if (!inPolygon(ix, iy, points(sprite.x1, sprite.y1, sprite.x2, sprite.y2, sprite.x3, sprite.y3, sprite.x4, sprite.y4))) return;
  hit.hit(t - SPRITE_OFF, sprId, EntityType.SPRITE, ix, iy, sinfo.z);
}

function intersectSprite(board: Board, artInfo: ArtInfoProvider, sprId: number, hit: Hitscan) {
  const spr = board.sprites[sprId];
  if (spr.picnum == 0 || spr.cstat.invisible) return;
  const sinfo = spriteInfo(board, sprId, artInfo);
  if (spr.cstat.type == FACE_SPRITE) {
    intersectFaceSprite(sprId, sinfo, hit);
  } else if (spr.cstat.type == WALL_SPRITE) {
    intersectWallSprite(board, sprId, sinfo, hit);
  } else if (spr.cstat.type == FLOOR_SPRITE) {
    intersectFloorSprite(sprId, sinfo, hit);
  }
}

function resetStack(board: Board, sectorId: number): Set<number> {
  if (sectorId == -1 || !board.sectors[sectorId]) return new Set(range(0, board.numsectors));
  else return new Set([sectorId]);
}

export function hitscan(board: Board, boardUtils: BoardUtils, artInfo: ArtInfoProvider, secId: number, hit: Hitscan, cliptype: number) {
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
