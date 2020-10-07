import { Board } from "../structs";
import { ArtProvider, BuildReferenceTracker } from "../../../app/apis/app";
import { vec3 } from "../../../libs_js/glmatrix";
import { Deck } from "../../../utils/collections";
import { wallNormal, ZSCALE, ANGSCALE } from "../../utils";
import { sectorWalls } from "../loops";
import { sectorOfWall, lastwall, wallInSector, isValidWallId } from "../query";
import { EngineApi } from "./api";
import { cyclic, int } from "../../../utils/mathutils";
import { setFirstWall } from "../mutations/sectors"
import { createNewSector } from "./ceatesector";
import { splitWall } from "./walls";
import { splitSector } from "../mutations/splitsector";
import { closestWallSegmentInSector } from "../distances";

export class Point {
  constructor(
    readonly off: number,
    readonly x: number,
    readonly y: number,
    readonly zup: number,
    readonly zdown: number,
    readonly zupoff = 0,
    readonly zdownoff = 0,
  ) { }
}

export enum PortalType { UP, DOWN, MID };
export type point_3d = [number, number, number];
export type projector = (x: number, y: number) => [number, number, number];

function findIndex(points: { off: number }[], off: number) {
  for (let i = 0; i < points.length; i++) if (points[i].off >= off) return i;
  return points.length;
}

function convert(hull: HullPoint[]) {
  const newHull: Point[] = [];
  let lastUp = 0, lastDown = 0;
  for (let i = 0; i < hull.length; i++) {
    const p = hull[i];
    if (i == 0) {
      newHull.push(new Point(p.off, int(p.x), int(p.y), p.upline[0], p.downline[0]));
    } else if (i == hull.length - 1) {
      newHull.push(new Point(p.off, int(p.x), int(p.y), lastUp, lastDown));
    } else {
      const upoff = p.upline[0] - lastUp;
      const downoff = p.downline[0] - lastDown;
      newHull.push(new Point(p.off, int(p.x), int(p.y), lastUp, lastDown, upoff, downoff));
    }
    lastUp = p.upline[1];
    lastDown = p.downline[1];
  }
  return newHull;
}

export function buildHull(points: point_3d[], proj: projector) {
  const hull: HullPoint[] = [];
  for (const [x, y, _] of points) {
    const [xp, yp, off] = proj(x, y);
    const idx = findIndex(hull, off);
    if (idx == hull.length || hull[idx].off != off) hull.splice(idx, 0, new HullPoint(off, xp, yp));
  }

  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[cyclic(i + 1, points.length)];
    const vertical = p1[0] == p2[0] && p1[1] == p2[1];
    if (!vertical) {
      const pp1 = proj(p1[0], p1[1]);
      const pp2 = proj(p2[0], p2[1]);
      const [start, end, dz, startz] = pp1[2] > pp2[2]
        ? [pp2[2], pp1[2], p1[2] - p2[2], p2[2]]
        : [pp1[2], pp2[2], p2[2] - p1[2], p1[2]];
      let idx = findIndex(hull, start);
      while (hull[idx].off != end) {
        const doff1 = (hull[idx].off - start) / (end - start);
        const doff2 = (hull[idx + 1].off - start) / (end - start);
        hull[idx].addLine(startz + doff1 * dz, startz + doff2 * dz)
        idx++;
      }
    }
  }
  return convert(hull);
}

class HullPoint {
  readonly upline: [number, number] = [-Number.MAX_VALUE, -Number.MAX_VALUE];
  readonly downline: [number, number] = [Number.MAX_VALUE, Number.MAX_VALUE];
  constructor(readonly off: number, readonly x: number, readonly y: number) { }

  addLine(z1: number, z2: number) {
    if (z1 == Number.MAX_VALUE || z1 == -Number.MAX_VALUE) return;
    if (z1 > this.upline[0] || (z1 == this.upline[0] && z2 > this.upline[1])) {
      const [lastup0, lastup1] = this.upline;
      this.upline[0] = z1;
      this.upline[1] = z2;
      this.addLine(lastup0, lastup1);
    } else if (z1 < this.downline[0] || (z1 == this.downline[0] && z2 < this.downline[1])) {
      const [lastdown0, lastdown1] = this.downline;
      this.downline[0] = z1;
      this.downline[1] = z2;
      this.addLine(lastdown0, lastdown1);
    }
  }
}

export function drawWall(board: Board, wallId: number, type: PortalType, hull: Point[], art: ArtProvider, refs: BuildReferenceTracker, api: EngineApi, dist: number) {
  if (!isValidWallId(board, wallId)) throw new Error(`Invalid wallId: ${wallId}`);
  const wall = board.walls[wallId];
  if (wall.nextsector == -1 && dist > 0) throw new Error();
  const [nx, , ny] = wallNormal(vec3.create(), board, wallId);
  const sectorId = sectorOfWall(board, wallId);
  for (const p of hull) splitWall(board, closestWallSegmentInSector(board, sectorId, p.x, p.y, 0), p.x, p.y, art, refs, api.cloneWall);
  if (type == PortalType.MID) mid(dist, hull, nx, ny, sectorId, board, refs, api);
  else if (type == PortalType.DOWN) nonMid(dist, hull, nx, ny, sectorId, board, refs, api, true);
  else if (type == PortalType.UP) nonMid(dist, hull, nx, ny, sectorId, board, refs, api, false);
}

function nonMid(dist: number, hull: Point[], nx: number, ny: number, sectorId: number, board: Board, refs: BuildReferenceTracker, api: EngineApi, down: boolean) {
  for (let i = 0; i < hull.length - 1; i++) {
    const p1 = hull[i];
    const p2 = hull[i + 1];
    const points = new Deck<[number, number]>();
    if (i == 0) points.push([p1.x, p1.y]);
    points
      .push([int(p1.x + nx * dist), int(p1.y + ny * dist)])
      .push([int(p2.x + nx * dist), int(p2.y + ny * dist)])
      .push([p2.x, p2.y])
    const sec = splitSector(board, sectorId, points, refs, api);
    const sector = board.sectors[sec];
    const firsWall = lastwall(board, wallInSector(board, sec, p1.x, p1.y));
    setFirstWall(board, sec, firsWall, refs);
    const doff = p2.off - p1.off;
    const z = down ? p1.zup + p1.zupoff : p1.zdown + p1.zdownoff;
    const k = (down ? (p2.zup - z) : (p2.zdown - z)) / doff;
    if (down) {
      sector.floorz = int(z * ZSCALE);
      sector.floorheinum = -int(k / ANGSCALE);
    } else {
      sector.ceilingz = int(z * ZSCALE);
      sector.ceilingheinum = -int(k / ANGSCALE);
    }
  }
}

function findPortalWall(board: Board, fromSectorId: number, toSectorId: number): number {
  for (const w of sectorWalls(board, fromSectorId)) if (board.walls[w].nextsector == toSectorId) return board.walls[w].nextwall;
  return -1;
}

function mid(dist: number, hull: Point[], nx: number, ny: number, sectorId: number, board: Board, refs: BuildReferenceTracker, api: EngineApi) {
  for (let i = 0; i < hull.length - 1; i++) {
    const p1 = hull[i];
    const p2 = hull[i + 1];
    const points = new Deck<[number, number]>()
      .push([p1.x, p1.y])
      .push([p2.x, p2.y])
      .push([int(p2.x + nx * dist), int(p2.y + ny * dist)])
      .push([int(p1.x + nx * dist), int(p1.y + ny * dist)]);
    const newSectorId = createNewSector(board, points, refs, api);
    const sector = board.sectors[newSectorId];
    const firsWall = wallInSector(board, newSectorId, p1.x, p1.y);
    setFirstWall(board, newSectorId, firsWall, refs);
    const doff = p2.off - p1.off;
    const floorz = p1.zdown + p1.zdownoff;
    const ceilingz = p1.zup + p1.zupoff;
    const floork = (p2.zdown - floorz) / doff;
    const ceilingk = (p2.zup - ceilingz) / doff;
    sector.floorz = int(floorz * ZSCALE);
    sector.ceilingz = int(ceilingz * ZSCALE);
    sector.floorheinum = -int(floork / ANGSCALE);
    sector.ceilingheinum = -int(ceilingk / ANGSCALE);
    const pwall = findPortalWall(board, newSectorId, sectorId);
    board.walls[pwall].cstat.alignBottom = 1;
  }
}