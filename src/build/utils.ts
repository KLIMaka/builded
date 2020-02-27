import * as MU from '../utils/mathutils';
import * as VEC from '../utils/vecmath';
import * as GLM from '../libs_js/glmatrix';
import { Collection, cyclicPairs } from '../utils/collections';
import { Board, Sector, Sprite, Wall } from './structs';
import { EntityType, Entity } from './hitscan';

export const ZSCALE = -16;

export function build2gl(out: GLM.Vec3Array, vec: GLM.Vec3Array): GLM.Vec3Array {
  return GLM.vec3.set(out, vec[0], vec[2] / ZSCALE, vec[1]);
}

export function gl2build(out: GLM.Vec3Array, vec: GLM.Vec3Array): GLM.Vec3Array {
  return GLM.vec3.set(out, vec[0], vec[2], vec[1] * ZSCALE);
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
    let sprite = board.sprites[i];
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

export function getSector(board: Board, ms: MoveStruct): number {
  if (inSector(board, ms.x, ms.y, ms.sec))
    return ms.sec;
  return -1;
}

export function inPolygon(x: number, y: number, xs: Collection<number>, ys: Collection<number>) {
  let inter = 0;
  for (let [i1, i2] of cyclicPairs(xs.length())) {
    let dy1 = ys.get(i1) - y;
    let dy2 = ys.get(i2) - y;
    let dx1 = xs.get(i1) - x;
    let dx2 = xs.get(i2) - x;
    if (dx1 == 0 && dx2 == 0 && (dy1 == 0 || dy2 == 0 || (dy1 ^ dy2) < 0)) return true;
    if (dy1 == 0 && dy2 == 0 && (dx1 == 0 || dx2 == 0 || (dx1 ^ dx2) < 0)) return true;

    if ((dy1 ^ dy2) < 0) {
      if ((dx1 ^ dx2) >= 0)
        inter ^= dx1;
      else
        inter ^= MU.cross2d(dx1, dy1, dx2, dy2) ^ dy2;
    }
  }
  return (inter >>> 31) == 1;
}

export function inSector(board: Board, x: number, y: number, secnum: number): boolean {
  x = MU.int(x);
  y = MU.int(y);
  let sec = board.sectors[secnum];
  if (!sec) return false;
  // let wallx = decorate(sub(wrap(board.walls, board.numwalls), sec.wallptr, sec.wallnum), (w: Wall) => w.x);
  // let wally = decorate(sub(wrap(board.walls, board.numwalls), sec.wallptr, sec.wallnum), (w: Wall) => w.y);
  // return inPolygon(x, y, wallx, wally);
  let end = sec.wallptr + sec.wallnum;
  let inter = 0;
  for (let w = sec.wallptr; w < end; w++) {
    let wall = board.walls[w];
    let wall2 = board.walls[wall.point2];
    let dy1 = wall.y - y;
    let dy2 = wall2.y - y;
    let dx1 = wall.x - x;
    let dx2 = wall2.x - x;
    if (dx1 == 0 && dx2 == 0 && (dy1 == 0 || dy2 == 0 || (dy1 ^ dy2) < 0)) return true;
    if (dy1 == 0 && dy2 == 0 && (dx1 == 0 || dx2 == 0 || (dx1 ^ dx2) < 0)) return true;

    if ((dy1 ^ dy2) < 0) {
      if ((dx1 ^ dx2) >= 0)
        inter ^= dx1;
      else
        inter ^= MU.cross2d(dx1, dy1, dx2, dy2) ^ dy2;
    }
  }
  return (inter >>> 31) == 1;
}

export function sectorOfWall(board: Board, wallId: number): number {
  if (wallId < 0 || wallId >= board.numwalls)
    return -1;
  let wall = board.walls[wallId];
  if (wall.nextwall != -1)
    return board.walls[wall.nextwall].nextsector;
  let start = 0;
  let end = board.numsectors - 1;
  while (end - start >= 0) {
    let pivot = MU.int(start + (end - start) / 2);
    let sec = board.sectors[pivot];
    if (sec.wallptr <= wallId && sec.wallptr + sec.wallnum - 1 >= wallId)
      return pivot;
    if (sec.wallptr > wallId) {
      end = pivot - 1;
    } else {
      start = pivot + 1;
    }
  }
}

export function sectorZ(board: Board, sectorEnt: Entity) {
  let sec = board.sectors[sectorEnt.id];
  return (sectorEnt.type == EntityType.CEILING ? sec.ceilingz : sec.floorz);
}

export function sectorHeinum(board: Board, sectorEnt: Entity) {
  let sec = board.sectors[sectorEnt.id];
  return (sectorEnt.type == EntityType.CEILING ? sec.ceilingheinum : sec.floorheinum);
}

export function setSectorZ(board: Board, sectorEnt: Entity, z: number): boolean {
  let pz = sectorZ(board, sectorEnt);
  if (pz == z) return false;
  let sec = board.sectors[sectorEnt.id];
  if (sectorEnt.type == EntityType.CEILING) sec.ceilingz = z; else sec.floorz = z;
  return true;
}

export function setSectorHeinum(board: Board, sectorEnt: Entity, h: number): boolean {
  let ph = sectorHeinum(board, sectorEnt);
  if (ph == h) return false;
  let sec = board.sectors[sectorEnt.id];
  if (sectorEnt.type == EntityType.CEILING) sec.ceilingheinum = h; else sec.floorheinum = h;
  return true;
}

export function sectorPicnum(board: Board, sectorEnt: Entity) {
  let sec = board.sectors[sectorEnt.id];
  return sectorEnt.type == EntityType.CEILING ? sec.ceilingpicnum : sec.floorpicnum;
}

export function setSectorPicnum(board: Board, sectorEnt: Entity, picnum: number): boolean {
  if (picnum == -1 || sectorPicnum(board, sectorEnt) == picnum) return false;
  let sec = board.sectors[sectorEnt.id];
  if (sectorEnt.type == EntityType.CEILING) sec.ceilingpicnum = picnum; else sec.floorpicnum = picnum;
  return true;
}

export function findSector(board: Board, x: number, y: number, secnum: number = -1): number {
  if (secnum == -1 || secnum >= board.numsectors)
    return findSectorAll(board, x, y);
  let secs = [secnum];
  for (let i = 0; i < secs.length; i++) {
    secnum = secs[i];
    let sec = board.sectors[secnum];
    if (inSector(board, x, y, secnum))
      return secnum;

    for (let w = 0; w < sec.wallnum; w++) {
      let wallidx = w + sec.wallptr;
      let wall = board.walls[wallidx];
      if (wall.nextsector != -1) {
        let nextsector = wall.nextsector;
        if (secs.indexOf(nextsector) == -1)
          secs.push(nextsector);
      }
    }
  }
  return -1;
}

function findSectorAll(board: Board, x: number, y: number) {
  for (let s = 0; s < board.numsectors; s++) {
    let sec = board.sectors[s];
    if (inSector(board, x, y, s))
      return s;
  }
  return -1;
}

export function getSprites(board: Board, secnum: number): number[] {
  let ret = [];
  let sprites = board.sprites;
  for (let i = 0; i < sprites.length; i++) {
    if (sprites[i].sectnum == secnum)
      ret.push(i);
  }
  return ret;
}

export function groupSprites(board: Board): { [index: number]: number[] } {
  let sec2spr: { [index: number]: number[] } = {};
  for (let s = 0; s < board.numsprites; s++) {
    let spr = board.sprites[s];
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
  let sec = board.sectors[sectorId];
  let wall1 = board.walls[sec.wallptr];
  let wall2 = board.walls[wall1.point2];
  let dx = wall2.x - wall1.x;
  let dy = wall2.y - wall1.y;
  let ln = MU.len2d(dx, dy);
  dx /= ln; dy /= ln;
  let dx1 = x - wall1.x;
  let dy1 = y - wall1.y;
  let k = -MU.cross2d(dx, dy, dx1, dy1);
  return MU.int(heinum * ANGSCALE * k * ZSCALE);
}

export function createSlopeCalculator(board: Board, sectorId: number) {
  let sector = board.sectors[sectorId];
  let wall1 = board.walls[sector.wallptr];
  let wall2 = board.walls[wall1.point2];
  let dx = wall2.x - wall1.x;
  let dy = wall2.y - wall1.y;
  let ln = MU.len2d(dx, dy);
  dx /= ln; dy /= ln;

  return function (x: number, y: number, heinum: number): number {
    let dx1 = x - wall1.x;
    let dy1 = y - wall1.y;
    let k = -MU.cross2d(dx, dy, dx1, dy1);
    return MU.int(heinum * ANGSCALE * k * ZSCALE);
  };
}

export function heinumCalc(board: Board, sectorId: number, x: number, y: number, z: number) {
  let sec = board.sectors[sectorId];
  let wall1 = board.walls[sec.wallptr];
  let wall2 = board.walls[wall1.point2];
  let dx = wall2.x - wall1.x;
  let dy = wall2.y - wall1.y;
  let ln = MU.len2d(dx, dy);
  dx /= ln; dy /= ln;
  let dx1 = x - wall1.x;
  let dy1 = y - wall1.y;
  let k = MU.cross2d(dx, dy, dx1, dy1);
  return Math.round(z / (ANGSCALE * k * ZSCALE));
}

export function lineIntersect(
  sx: number, sy: number, sz: number,
  x2: number, y2: number, z2: number,
  x3: number, y3: number, x4: number, y4: number): [number, number, number, number] {

  let x21 = x2 - sx, x34 = x3 - x4;
  let y21 = y2 - sy, y34 = y3 - y4;
  let bot = MU.cross2d(x21, y21, x34, y34);

  if (bot == 0) return null;

  let x31 = x3 - sx, y31 = y3 - sy;
  let topt = MU.cross2d(x31, y31, x34, y34);

  if (bot > 0) {
    if ((topt < 0) || (topt >= bot))
      return null;
    let topu = MU.cross2d(x21, y31, x31, y31);
    if ((topu < 0) || (topu >= bot))
      return null;
  } else {
    if ((topt > 0) || (topt <= bot))
      return null;
    let topu = MU.cross2d(x21, y21, x31, y31);
    if ((topu > 0) || (topu <= bot))
      return null;
  }

  let t = topt / bot;
  let x = sx + MU.int(x21 * t);
  let y = sy + MU.int(y21 * t);
  let z = sz + MU.int((z2 - sz) * t) * ZSCALE;

  return [x, y, z, t];
}

export function rayIntersect(
  xs: number, ys: number, zs: number,
  vx: number, vy: number, vz: number,
  x3: number, y3: number, x4: number, y4: number): [number, number, number, number] {

  let x34 = x3 - x4;
  let y34 = y3 - y4;
  let bot = MU.cross2d(vx, vy, x34, y34);
  if (bot == 0) return null;
  let x31 = x3 - xs;
  let y31 = y3 - ys;
  let topt = MU.cross2d(x31, y31, x34, y34);

  if (bot > 0) {
    if (topt < 0) return null;
    let topu = MU.cross2d(vx, vy, x31, y31);
    if ((topu < 0) || (topu >= bot))
      return null;
  } else {
    if (topt > 0) return null;
    let topu = MU.cross2d(vx, vy, x31, y31);
    if ((topu > 0) || (topu <= bot))
      return null;
  }

  let t = topt / bot;
  let x = xs + MU.int(vx * t);
  let y = ys + MU.int(vy * t);
  let z = zs + MU.int(vz * t);

  return [x, y, z, t];
}

export function getFirstWallAngle(sector: Sector, walls: Wall[]): number {
  let w1 = walls[sector.wallptr];
  let w2 = walls[w1.point2];
  let dx = w2.x - w1.x;
  let dy = w2.y - w1.y;
  return Math.atan2(-dy, dx);
}

export function wallVisible(board: Board, wallId: number, ms: MoveStruct) {
  let wall1 = board.walls[wallId];
  let wall2 = board.walls[wall1.point2];
  let dx1 = wall2.x - wall1.x;
  let dy1 = wall2.y - wall1.y;
  let dx2 = ms.x - wall1.x;
  let dy2 = ms.y - wall1.y;
  return MU.cross2d(dx1, dy1, dx2, dy2) >= 0;
}

let normal = GLM.vec2.create();
export function wallNormal(out: GLM.Vec3Array, board: Board, wallId: number): GLM.Vec3Array {
  let w1 = board.walls[wallId];
  let w2 = board.walls[w1.point2];
  GLM.vec2.set(normal, w1.x - w2.x, w1.y - w2.y);
  VEC.normal2d(normal, normal);
  GLM.vec3.set(out, normal[0], 0, normal[1]);
  return out;
}

let wn = GLM.vec3.create();
let up = GLM.vec3.fromValues(0, 1, 0);
let down = GLM.vec3.fromValues(0, -1, 0);
export function sectorNormal(out: GLM.Vec3Array, board: Board, sectorId: number, ceiling: boolean): GLM.Vec3Array {
  let sec = board.sectors[sectorId];
  wallNormal(wn, board, sec.wallptr);
  GLM.vec3.negate(wn, wn);
  let h = ceiling ? sec.ceilingheinum : sec.floorheinum;
  let normal = ceiling ? down : up;
  GLM.vec3.lerp(out, normal, wn, Math.atan(h * ANGSCALE) / (Math.PI / 2));
  return out;
}

export function ang2vec(ang: number): GLM.Vec3Array {
  ang += Math.PI / 2;
  return GLM.vec3.fromValues(Math.sin(ang), 0, Math.cos(ang))
}

export function spriteAngle(ang: number): number {
  return MU.PI2 - (ang * ANGSCALE * 2) * MU.PI2;
}

export function vec2ang(x: number, y: number) {
  return MU.int((MU.monoatan2(y, x) / MU.PI2) / ANGSCALE / 2);
}
