import { closestWallSegmentInSector } from "../../../build/board/distances";
import { sectorWalls } from "../../../build/board/loops";
import { EngineApi } from "../../../build/board/mutations/api";
import { createNewSector } from "../../../build/board/mutations/ceatesector";
import { setFirstWall } from "../../../build/board/mutations/sectors";
import { splitSector } from "../../../build/board/mutations/splitsector";
import { splitWall } from "../../../build/board/mutations/walls";
import { lastwall, sectorOfWall, wallInSector } from "../../../build/board/query";
import { Board } from "../../../build/board/structs";
import { ANGSCALE, build2gl, createSlopeCalculator, wallNormal, ZSCALE } from "../../../build/utils";
import { vec2, vec3 } from "../../../libs_js/glmatrix";
import { Deck } from "../../../utils/collections";
import { Injector } from "../../../utils/injector";
import { cyclic, dot2d, int } from "../../../utils/mathutils";
import { ART, ArtProvider, BOARD, BoardProvider, BuildReferenceTracker, ENGINE_API, GRID, GridController, REFERENCE_TRACKER, View, VIEW } from "../../apis/app";
import { BUS, MessageBus, MessageHandlerReflective } from "../../apis/handler";
import { Renderables } from "../../apis/renderable";
import { BuildersFactory, BUILDERS_FACTORY } from "../../modules/geometry/common";
import { LineBuilder } from "../../modules/gl/buffers";
import { MovingHandle } from "../handle";
import { BoardInvalidate, COMMIT, Frame, NamedMessage, Render } from "../messages";

export type point_3d = [number, number, number];
export type projector = (x: number, y: number) => [number, number, number];

function findIndex(points: { off: number }[], off: number) {
  for (let i = 0; i < points.length; i++) if (points[i].off >= off) return i;
  return points.length;
}

export function buildHull(points: point_3d[], proj: projector) {
  const hull: HullPoint[] = [];
  for (const [x, y, z] of points) {
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

enum PortalType { UP, DOWN, MID };
class PortalModel {
  private wallId: number;
  private wallVec = vec2.create();
  private wallNormal = vec2.create();
  private startPoint = vec2.create();
  private type: PortalType;
  private points: point_3d[] = [];
  private pointer: point_3d;
  private slope: (x: number, y: number) => number;
  private needToUpdate = true;
  private lastMove: point_3d = [0, 0, 0];
  private lastDistance = 0;

  constructor(
    factory: BuildersFactory,
    private contour = factory.wireframe('utils'),
    private contourPoints = factory.pointSprite('utils'),
    private length = factory.pointSprite('utils'),
    private renderable = new Renderables([contour, contourPoints, length])
  ) { }

  public getRenderable(distance: number) {
    if (this.lastDistance != distance) {
      this.lastDistance = distance;
      this.needToUpdate = true;
    }
    this.update();
    return this.renderable
  }

  public start(board: Board, wallId: number, x: number, y: number, z: number) {
    this.pointer = [x, y, z];
    this.points = [];
    this.wallId = wallId;
    const wall = board.walls[wallId];
    const wall2 = board.walls[wall.point2];
    vec2.set(this.wallVec, wall2.x - wall.x, wall2.y - wall.y);
    vec2.normalize(this.wallVec, this.wallVec);
    const [nx, , ny] = wallNormal(vec3.create(), board, wallId);
    vec2.set(this.wallNormal, nx, ny);
    vec2.set(this.startPoint, wall.x, wall.y);
    const sectorId = sectorOfWall(board, wallId);
    const sector = board.sectors[sectorId];
    if (wall.nextsector == -1) {
      this.type = PortalType.MID;
    } else {
      const nextsectorId = wall.nextsector;
      const nextsector = board.sectors[nextsectorId];
      const curslope = createSlopeCalculator(board, sectorId);
      const nextslope = createSlopeCalculator(board, nextsectorId);
      const cz = curslope(x, y, sector.ceilingheinum) + sector.ceilingz;
      const cnz = nextslope(x, y, nextsector.ceilingheinum) + nextsector.ceilingz;
      const fz = curslope(x, y, sector.floorheinum) + sector.floorz;
      const fnz = nextslope(x, y, nextsector.floorheinum) + nextsector.floorz;
      if (z >= fnz && z <= fz) {
        this.type = PortalType.DOWN;
        this.slope = (x: number, y: number) => (curslope(x, y, sector.floorheinum) + sector.floorz) / ZSCALE;
      } else if (z <= cnz && z >= cz) {
        this.type = PortalType.UP;
        this.slope = (x: number, y: number) => (curslope(x, y, sector.ceilingheinum) + sector.ceilingz) / ZSCALE;
      } else throw new Error(`Invalid point`);
    }
    this.move(x, y, z);
    this.addPoint();
  }

  public stop(board: Board, art: ArtProvider, refs: BuildReferenceTracker, api: EngineApi, dist: number) {
    const hull = buildHull([...this.points, this.pointer], (x, y) => this.project(x, y));
    const [nx, , ny] = wallNormal(vec3.create(), board, this.wallId);
    const sectorId = sectorOfWall(board, this.wallId);
    for (const p of hull) splitWall(board, closestWallSegmentInSector(board, sectorId, p.x, p.y, 0), p.x, p.y, art, refs, api.cloneWall);
    if (this.type == PortalType.MID) this.mid(dist, hull, nx, ny, sectorId, board, refs, api);
    else if (this.type == PortalType.DOWN) this.nonMid(dist, hull, nx, ny, sectorId, board, refs, api, true);
    else if (this.type == PortalType.UP) this.nonMid(dist, hull, nx, ny, sectorId, board, refs, api, false);
  }

  private nonMid(dist: number, hull: Point[], nx: number, ny: number, sectorId: number, board: Board, refs: BuildReferenceTracker, api: EngineApi, down: boolean) {
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

  private findPortalWall(board: Board, fromSectorId: number, toSectorId: number): number {
    for (const w of sectorWalls(board, fromSectorId)) if (board.walls[w].nextsector == toSectorId) return board.walls[w].nextwall;
    return -1;
  }

  private mid(dist: number, hull: Point[], nx: number, ny: number, sectorId: number, board: Board, refs: BuildReferenceTracker, api: EngineApi) {
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
      const pwall = this.findPortalWall(board, newSectorId, sectorId);
      board.walls[pwall].cstat.alignBottom = 1;
    }
  }

  private project(x: number, y: number): point_3d {
    const t = vec2.fromValues(x, y);
    vec2.sub(t, t, this.startPoint);
    const off = vec2.dot(this.wallVec, t);
    vec2.copy(t, this.wallVec);
    vec2.scale(t, t, off);
    vec2.add(t, t, this.startPoint);
    return [t[0], t[1], off];
  }

  public move(x: number, y: number, z: number) {
    const [xp, yp, off] = this.project(x, y);
    if (this.needToMove(xp, yp, z)) return;
    this.pointer[0] = xp;
    this.pointer[1] = yp;
    this.pointer[2] = z / ZSCALE;
    this.needToUpdate = true;
    this.updateLastMove(xp, yp, z);
  }

  private needToMove(x: number, y: number, z: number) {
    return this.lastMove[0] == x && this.lastMove[1] == y && this.lastMove[2] == z;
  }

  private updateLastMove(x: number, y: number, z: number) {
    this.lastMove[0] = x;
    this.lastMove[1] = y;
    this.lastMove[2] = z;
  }

  public addPoint() {
    this.points.push(this.pointer);
    this.pointer = [...this.pointer];
    this.needToUpdate = true;
  }

  public popPoint() {
    this.points.pop();
    this.needToUpdate = true;
  }

  private update() {
    if (!this.needToUpdate) return;
    this.updateContour();
    this.updateContourPoints();
    this.needToUpdate = false;
  }

  private updateContourPoints() {
  }

  private updateContour() {
    this.contour.needToRebuild();
    const hull = buildHull([...this.points, this.pointer], (x, y) => this.project(x, y));
    const line = new LineBuilder();
    if (this.type == PortalType.DOWN) this.buildNonMid(line, hull, true);
    else if (this.type == PortalType.UP) this.buildNonMid(line, hull, false);
    else if (this.type == PortalType.MID) this.buildMid(line, hull);
    // for (const [p1, p2] of loopPairs([...this.points, this.pointer])) line.segment(p1[0], p1[2], p1[1], p2[0], p2[2], p2[1])
    line.build(this.contour.buff);
  }

  private buildMid(line: LineBuilder, hull: Point[],) {
    const last = hull[hull.length - 1];
    const first = hull[0];
    this.addSegment(line, last.x, last.zdown, last.y, last.x, last.zup, last.y);
    this.addSegment(line, first.x, first.zdown, first.y, first.x, first.zup, first.y);
    for (let i = 0; i < hull.length - 1; i++) {
      const p1 = hull[i];
      const p2 = hull[i + 1];
      this.addSegment(line, p1.x, p1.zup, p1.y, p1.x, p1.zup + p1.zupoff, p1.y);
      this.addSegment(line, p1.x, p1.zdown, p1.y, p1.x, p1.zdown + p1.zdownoff, p1.y);
      this.addSegment(line, p1.x, p1.zup + p1.zupoff, p1.y, p2.x, p2.zup, p2.y);
      this.addSegment(line, p1.x, p1.zdown + p1.zdownoff, p1.y, p2.x, p2.zdown, p2.y);
    }
  }

  private buildNonMid(line: LineBuilder, hull: Point[], down: boolean) {
    const last = hull[hull.length - 1];
    const first = hull[0];
    const lastz = this.slope(last.x, last.y);
    const firstz = this.slope(first.x, first.y);
    this.addSegment(line, last.x, lastz, last.y, last.x, down ? last.zup : last.zdown, last.y);
    this.addSegment(line, first.x, firstz, first.y, first.x, down ? first.zup : first.zdown, first.y);
    this.addSegment(line, last.x, lastz, last.y, first.x, firstz, first.y);
    for (let i = 0; i < hull.length - 1; i++) {
      const p1 = hull[i];
      const p2 = hull[i + 1];
      this.addSegment(line, p1.x, down ? p1.zup : p1.zdown, p1.y, p1.x, down ? p1.zup + p1.zupoff : p1.zdown + p1.zdownoff, p1.y);
      this.addSegment(line, p1.x, down ? p1.zup + p1.zupoff : p1.zdown + p1.zdownoff, p1.y, p2.x, down ? p2.zup : p2.zdown, p2.y);
    }
  }

  private addSegment(line: LineBuilder, x1: number, z1: number, y1: number, x2: number, z2: number, y2: number) {
    const dx = this.lastDistance * this.wallNormal[0];
    const dy = this.lastDistance * this.wallNormal[1];
    line.segment(x1, z1, y1, x2, z2, y2);
    line.segment(x1 + dx, z1, y1 + dy, x2 + dx, z2, y2 + dy);
    line.segment(x1 + dx, z1, y1 + dy, x1, z1, y1);
    line.segment(x2 + dx, z2, y2 + dy, x2, z2, y2);
  }
}

export async function DrawWallModule(injector: Injector) {
  const [bus, api, builders, view, board, refs, art, grid] = await Promise.all([
    injector.getInstance(BUS),
    injector.getInstance(ENGINE_API),
    injector.getInstance(BUILDERS_FACTORY),
    injector.getInstance(VIEW),
    injector.getInstance(BOARD),
    injector.getInstance(REFERENCE_TRACKER),
    injector.getInstance(ART),
    injector.getInstance(GRID),
  ]);
  bus.connect(new DrawWall(builders, api, view, board, refs, bus, art, grid));
}

export class DrawWall extends MessageHandlerReflective {
  private wallId = -1;
  private movingHandle = new MovingHandle();

  constructor(
    factory: BuildersFactory,
    private api: EngineApi,
    private view: View,
    private board: BoardProvider,
    private refs: BuildReferenceTracker,
    private bus: MessageBus,
    private art: ArtProvider,
    private grid: GridController,
    private portal = new PortalModel(factory),
  ) { super() }

  private start() {
    const target = this.view.snapTarget();
    if (target.entity == null || !target.entity.isWall()) return;
    const [x, y, z] = target.coords;
    this.portal.start(this.board(), target.entity.id, x, y, z);
    this.wallId = target.entity.id;
  }

  private stop() {
    this.portal.stop(this.board(), this.art, this.refs, this.api, this.getDistance());
    this.wallId = -1;
    this.bus.handle(COMMIT);
    this.bus.handle(new BoardInvalidate(null));
    this.movingHandle.stop();
  }

  private insertPoint() {
    if (this.wallId == -1) this.start();
    else this.portal.addPoint();
  }

  private popPoint() {
    if (this.wallId == -1) return;
    else this.portal.popPoint();
  }

  private pushPortal() {
    const target = this.view.snapTarget();
    this.movingHandle.start(build2gl(vec3.create(), target.coords));
  }

  private _wallNormal = vec3.create();
  private getDistance(): number {
    if (!this.movingHandle.isActive()) return 0;
    const dx = this.movingHandle.dx;
    const dy = this.movingHandle.dy;
    const [nx, , ny] = wallNormal(this._wallNormal, this.board(), this.wallId);
    return this.grid.snap(dot2d(nx, ny, dx, dy));
  }

  public NamedMessage(msg: NamedMessage) {
    switch (msg.name) {
      case 'draw_point': this.insertPoint(); return;
      case 'undo_draw_point': this.popPoint(); return;
      case 'push_portal': this.pushPortal(); return;
      case 'draw_portal': this.stop(); return;
    }
  }

  private _start = vec3.create();
  private _dir = vec3.create();
  public Frame(msg: Frame) {
    if (this.wallId == -1) return;
    if (this.movingHandle.isActive()) {
      const { start, dir } = this.view.dir();
      this.movingHandle.update(false, false, build2gl(this._start, start), build2gl(this._dir, dir));
    } else {
      const target = this.view.snapTarget();
      const [x, y, z] = target.coords;
      this.portal.move(x, y, z);
    }
  }

  public Render(msg: Render) {
    if (this.wallId == -1) return;
    msg.consumer(this.portal.getRenderable(this.getDistance()));
  }
}