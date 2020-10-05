import { vec2, vec3, Vec3Array } from '../libs_js/glmatrix';
import { loopPairs } from '../utils/collections';
import { cross2d, int, len2d, monoatan2, PI2 } from '../utils/mathutils';
import { normal2d } from '../utils/vecmath';
import { sectorWalls } from './board/loops';
import { Board, Sprite } from './board/structs';
import { Entity, EntityType } from './hitscan';

export const ZSCALE = -16;


export function build2gl(out: Vec3Array, vec: Vec3Array): Vec3Array {
  return vec3.set(out, vec[0], vec[2] / ZSCALE, vec[1]);
}

export function gl2build(out: Vec3Array, vec: Vec3Array): Vec3Array {
  return vec3.set(out, vec[0], vec[2], vec[1] * ZSCALE);
}

let fakePlayerStart_: Sprite;
function fakePlayerStart() {
  if (fakePlayerStart_ == null) {
    fakePlayerStart_ = new Sprite();
    fakePlayerStart_.x = 0
    fakePlayerStart_.y = 0
    fakePlayerStart_.z = 0
    fakePlayerStart_.sectnum = -1;
  }
  return fakePlayerStart_;
}

export function getPlayerStart(board: Board): Sprite {
  for (let i = 0; i < board.numsprites; i++) {
    const sprite = board.sprites[i];
    if (sprite.lotag == 1)
      return sprite;
  }
  return fakePlayerStart();
}

export interface MoveStruct {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly sec: number;
}

export function inPolygon(x: number, y: number, points: Iterable<[number, number]>) {
  let inter = 0;
  for (const [p1, p2] of loopPairs(points)) {
    const [x1, y1] = p1;
    const [x2, y2] = p2;
    const dx1 = x1 - x;
    const dx2 = x2 - x;
    const dy1 = y1 - y;
    const dy2 = y2 - y;
    if (dx1 == 0 && dx2 == 0 && (dy1 == 0 || dy2 == 0 || (dy1 ^ dy2) < 0)) return true;
    if (dy1 == 0 && dy2 == 0 && (dx1 == 0 || dx2 == 0 || (dx1 ^ dx2) < 0)) return true;

    if ((dy1 ^ dy2) < 0) {
      if ((dx1 ^ dx2) >= 0)
        inter ^= dx1;
      else
        inter ^= cross2d(dx1, dy1, dx2, dy2) ^ dy2;
    }
  }
  return (inter >>> 31) == 1;
}

export function sectorZ(board: Board, sectorEnt: Entity) {
  const sec = board.sectors[sectorEnt.id];
  return (sectorEnt.type == EntityType.CEILING ? sec.ceilingz : sec.floorz);
}

export function sectorHeinum(board: Board, sectorEnt: Entity) {
  const sec = board.sectors[sectorEnt.id];
  return (sectorEnt.type == EntityType.CEILING ? sec.ceilingheinum : sec.floorheinum);
}

export function setSectorZ(board: Board, sectorEnt: Entity, z: number): boolean {
  const pz = sectorZ(board, sectorEnt);
  if (pz == z) return false;
  const sec = board.sectors[sectorEnt.id];
  if (sectorEnt.type == EntityType.CEILING) sec.ceilingz = z; else sec.floorz = z;
  return true;
}

export function setSectorHeinum(board: Board, sectorEnt: Entity, h: number): boolean {
  const ph = sectorHeinum(board, sectorEnt);
  if (ph == h) return false;
  const sec = board.sectors[sectorEnt.id];
  if (sectorEnt.type == EntityType.CEILING) sec.ceilingheinum = h; else sec.floorheinum = h;
  return true;
}

export function sectorPicnum(board: Board, sectorEnt: Entity) {
  const sec = board.sectors[sectorEnt.id];
  return sectorEnt.type == EntityType.CEILING ? sec.ceilingpicnum : sec.floorpicnum;
}

export function setSectorPicnum(board: Board, sectorEnt: Entity, picnum: number): boolean {
  if (picnum == -1 || sectorPicnum(board, sectorEnt) == picnum) return false;
  const sec = board.sectors[sectorEnt.id];
  if (sectorEnt.type == EntityType.CEILING) sec.ceilingpicnum = picnum; else sec.floorpicnum = picnum;
  return true;
}

export function groupSprites(board: Board): { [index: number]: number[] } {
  const sec2spr: { [index: number]: number[] } = {};
  for (let s = 0; s < board.numsprites; s++) {
    const spr = board.sprites[s];
    let sprs = sec2spr[spr.sectnum];
    if (sprs == undefined) {
      sprs = [];
      sec2spr[spr.sectnum] = sprs;
    }
    sprs.push(s);
  }
  return sec2spr;
}

export const ANGSCALE = (1 / 4096);

export function slope(board: Board, sectorId: number, x: number, y: number, heinum: number) {
  const sec = board.sectors[sectorId];
  const wall1 = board.walls[sec.wallptr];
  const wall2 = board.walls[wall1.point2];
  let dx = wall2.x - wall1.x;
  let dy = wall2.y - wall1.y;
  const ln = len2d(dx, dy);
  dx /= ln; dy /= ln;
  const dx1 = x - wall1.x;
  const dy1 = y - wall1.y;
  const k = -cross2d(dx, dy, dx1, dy1);
  return int(heinum * ANGSCALE * k * ZSCALE);
}

export function createSlopeCalculator(board: Board, sectorId: number) {
  const sector = board.sectors[sectorId];
  const wall1 = board.walls[sector.wallptr];
  const wall2 = board.walls[wall1.point2];
  let dx = wall2.x - wall1.x;
  let dy = wall2.y - wall1.y;
  const ln = len2d(dx, dy);
  dx /= ln; dy /= ln;

  return function (x: number, y: number, heinum: number): number {
    const dx1 = x - wall1.x;
    const dy1 = y - wall1.y;
    const k = -cross2d(dx, dy, dx1, dy1);
    return int(heinum * ANGSCALE * k * ZSCALE);
  };
}

export function lineIntersect(
  sx: number, sy: number, sz: number,
  x2: number, y2: number, z2: number,
  x3: number, y3: number, x4: number, y4: number): [number, number, number, number] {

  const x21 = x2 - sx, x34 = x3 - x4;
  const y21 = y2 - sy, y34 = y3 - y4;
  const bot = cross2d(x21, y21, x34, y34);

  if (bot == 0) return null;

  const x31 = x3 - sx, y31 = y3 - sy;
  const topt = cross2d(x31, y31, x34, y34);

  if (bot > 0) {
    if ((topt < 0) || (topt >= bot))
      return null;
    const topu = cross2d(x21, y31, x31, y31);
    if ((topu < 0) || (topu >= bot))
      return null;
  } else {
    if ((topt > 0) || (topt <= bot))
      return null;
    const topu = cross2d(x21, y21, x31, y31);
    if ((topu > 0) || (topu <= bot))
      return null;
  }

  const t = topt / bot;
  const x = sx + int(x21 * t);
  const y = sy + int(y21 * t);
  const z = sz + int((z2 - sz) * t) * ZSCALE;

  return [x, y, z, t];
}

export function rayIntersect(
  xs: number, ys: number, zs: number,
  vx: number, vy: number, vz: number,
  x3: number, y3: number, x4: number, y4: number): [number, number, number, number] {

  const x34 = x3 - x4;
  const y34 = y3 - y4;
  const bot = cross2d(vx, vy, x34, y34);
  if (bot == 0) return null;
  const x31 = x3 - xs;
  const y31 = y3 - ys;
  const topt = cross2d(x31, y31, x34, y34);

  if (bot > 0) {
    if (topt < 0) return null;
    const topu = cross2d(vx, vy, x31, y31);
    if ((topu < 0) || (topu >= bot))
      return null;
  } else {
    if (topt > 0) return null;
    const topu = cross2d(vx, vy, x31, y31);
    if ((topu > 0) || (topu <= bot))
      return null;
  }

  const t = topt / bot;
  const x = xs + int(vx * t);
  const y = ys + int(vy * t);
  const z = zs + int(vz * t);

  return [x, y, z, t];
}

export function getFirstWallAngle(board: Board, sectorId: number): number {
  const sector = board.sectors[sectorId];
  const w1 = board.walls[sector.wallptr];
  const w2 = board.walls[w1.point2];
  const dx = w2.x - w1.x;
  const dy = w2.y - w1.y;
  return Math.atan2(-dy, dx);
}

export function wallVisible(board: Board, wallId: number, ms: MoveStruct) {
  const wall1 = board.walls[wallId];
  const wall2 = board.walls[wall1.point2];
  const dx1 = wall2.x - wall1.x;
  const dy1 = wall2.y - wall1.y;
  const dx2 = ms.x - wall1.x;
  const dy2 = ms.y - wall1.y;
  return cross2d(dx1, dy1, dx2, dy2) >= 0;
}

const _normal = vec2.create();
export function wallNormal(out: Vec3Array, board: Board, wallId: number): Vec3Array {
  const w1 = board.walls[wallId];
  const w2 = board.walls[w1.point2];
  vec2.set(_normal, w1.x - w2.x, w1.y - w2.y);
  normal2d(_normal, _normal);
  vec3.set(out, _normal[0], 0, _normal[1]);
  return out;
}

const _wn = vec3.create();
const _up = vec3.fromValues(0, 1, 0);
const _down = vec3.fromValues(0, -1, 0);
export function sectorNormal(out: Vec3Array, board: Board, sectorId: number, ceiling: boolean): Vec3Array {
  const sector = board.sectors[sectorId];
  wallNormal(_wn, board, sector.wallptr);
  vec3.negate(_wn, _wn);
  const h = ceiling ? sector.ceilingheinum : sector.floorheinum;
  const normal = ceiling ? _down : _up;
  vec3.lerp(out, normal, _wn, Math.atan(h * ANGSCALE) / (Math.PI / 2));
  return out;
}

export function ang2vec(ang: number): Vec3Array {
  ang += Math.PI / 2;
  return vec3.fromValues(Math.sin(ang), 0, Math.cos(ang))
}

export function spriteAngle(ang: number): number {
  return PI2 - (ang * ANGSCALE * 2) * PI2;
}

export function vec2ang(x: number, y: number) {
  return int((monoatan2(y, x) / PI2) / ANGSCALE / 2);
}
