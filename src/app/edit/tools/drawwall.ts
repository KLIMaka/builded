import { clockwise } from "../../../build/board/internal";
import { Board } from "../../../build/board/structs";
import { createSlopeCalculator, sectorOfWall, ZSCALE } from "../../../build/utils";
import { vec2 } from "../../../libs_js/glmatrix";
import { reversed, wrap } from "../../../utils/collections";
import { create, Injector } from "../../../utils/injector";
import { iter } from "../../../utils/iter";
import { cyclic } from "../../../utils/mathutils";
import { ART, ArtProvider, BOARD, BoardProvider, BuildReferenceTracker, REFERENCE_TRACKER, View, VIEW } from "../../apis/app";
import { BUS, MessageBus, MessageHandlerReflective } from "../../apis/handler";
import { Renderables } from "../../apis/renderable";
import { BuildersFactory, BUILDERS_FACTORY } from "../../modules/geometry/common";
import { LineBuilder } from "../../modules/gl/buffers";
import { Frame, NamedMessage, Render } from "../messages";

export type point_3d = [number, number, number];
export type projector = (x: number, y: number) => [number, number, number];

function fixOrder(points: point_3d[], proj: projector): point_3d[] {
  const cw = clockwise(iter(points).map(p => <[number, number]>[proj(p[0], p[1])[2], p[2]]));
  return cw ? [...reversed(wrap(points))] : points;
}

function findIndex(points: Point[], off: number) {
  for (let i = 0; i < points.length; i++) if (points[i].off >= off) return i;
  return points.length;
}

export function buildHull(points: point_3d[], proj: projector) {
  points = fixOrder(points, proj);
  const hull: Point[] = [];
  for (const [x, y, z] of points) {
    const [xp, yp, off] = proj(x, y);
    const idx = findIndex(hull, off);
    if (idx == hull.length || hull[idx].off != off) hull.splice(idx, 0, new Point(off, xp, yp, z));
  }

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[cyclic(i + 1, points.length)];
    const vertical = p1[0] == p2[0] && p1[1] == p2[1];
    if (vertical) {
      const dz = p2[2] - p1[2];
      const p0 = points[cyclic(i - 1, points.length)];
      const pp0 = proj(p0[0], p0[1]);
      const pp1 = proj(p1[0], p1[1]);
      const doff = pp1[2] - pp0[2];
      const idx = findIndex(hull, pp1[2]);
      if (doff > 0) hull[idx].updateZVertical(p1[2], dz);
      else hull[idx].updateZVertical(p2[2], -dz);
    } else {
      const pp1 = proj(p1[0], p1[1]);
      const pp2 = proj(p2[0], p2[1]);
      const [start, end, dz, startz] = pp1[2] > pp2[2]
        ? [pp2[2], pp1[2], p1[2] - p2[2], p2[2]]
        : [pp1[2], pp2[2], p2[2] - p1[2], p1[2]];
      let idx = findIndex(hull, start);
      while (hull[idx].off != end) {
        const doff = (hull[idx].off - start) / (end - start);
        hull[idx].updateZ(startz + doff * dz)
        idx++;
      }
    }
  }
  return hull;
}

export class Point {
  constructor(
    readonly off: number,
    readonly x: number,
    readonly y: number,
    public zup: number,
    public zdown: number = zup,
    public zupoff = 0,
    public zdownoff = 0,
  ) { }

  public updateZ(z: number) {
    if (z > this.zup + this.zupoff) {
      this.zdown = this.zup;
      this.zdownoff = this.zupoff;
      this.zup = z;
      this.zupoff = 0;
      // this.fixDown();
    } else {
      this.zdown = z;
      this.zdownoff = 0;
      // this.fixUp();
    }
  }

  public updateZVertical(z: number, dz: number) {
    if (z >= this.zup) {
      this.zdown = z + dz;
      this.zdownoff = 0;
      this.zup = z;
      this.zupoff = dz;
      // this.fixDown();
    } else {
      this.zdown = z;
      this.zdownoff = dz;
      // this.fixUp();
    }
  }

  private fixDown() {
    this.zdown = Math.min(this.zdown, this.zup);
    this.zdownoff = Math.min(this.zup + this.zupoff, this.zdown + this.zdownoff) - this.zdown;
  }

  private fixUp() {
    this.zup = Math.max(this.zdown, this.zup);
    this.zupoff = Math.max(this.zup + this.zupoff, this.zdown + this.zdownoff) - this.zup;
  }
}

enum PortalType { UP, DOWN, MID };
class PortalModel {
  private wallVec = vec2.create();
  private startPoint = vec2.create();
  private type: PortalType;
  private points: point_3d[] = [];
  private pointer: point_3d;
  private slope: (x: number, y: number) => number;
  private needToUpdate = true;
  private lastMove: point_3d = [0, 0, 0];

  constructor(
    factory: BuildersFactory,
    private art: ArtProvider,
    private contour = factory.wireframe('utils'),
    private contourPoints = factory.pointSprite('utils'),
    private length = factory.pointSprite('utils'),
    private renderable = new Renderables([contour, contourPoints, length])
  ) { }

  public getRenderable() { this.update(); return this.renderable }

  public start(board: Board, wallId: number, x: number, y: number, z: number) {
    this.pointer = [x, y, z];
    this.points = [];
    const wall = board.walls[wallId];
    const wall2 = board.walls[wall.point2];
    vec2.set(this.wallVec, wall2.x - wall.x, wall2.y - wall.y);
    vec2.normalize(this.wallVec, this.wallVec);
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
    line.segment(last.x, last.zdown, last.y, last.x, last.zup, last.y);
    line.segment(first.x, first.zdown, first.y, first.x, first.zup, first.y);
    for (let i = 0; i < hull.length - 1; i++) {
      const p1 = hull[i];
      const p2 = hull[i + 1];
      line.segment(p1.x, p1.zup, p1.y, p1.x, p1.zup + p1.zupoff, p1.y);
      line.segment(p1.x, p1.zdown, p1.y, p1.x, p1.zdown + p1.zdownoff, p1.y);
      line.segment(p1.x, p1.zup + p1.zupoff, p1.y, p2.x, p2.zup, p2.y);
      line.segment(p1.x, p1.zdown + p1.zdownoff, p1.y, p2.x, p2.zdown, p2.y);
    }
  }

  private buildNonMid(line: LineBuilder, hull: Point[], down: boolean) {
    const last = hull[hull.length - 1];
    const first = hull[0];
    const lastz = this.slope(last.x, last.y);
    const firstz = this.slope(first.x, first.y);
    line.segment(last.x, lastz, last.y, last.x, down ? last.zup : last.zdown, last.y);
    line.segment(first.x, firstz, first.y, first.x, down ? first.zup : first.zdown, first.y);
    line.segment(last.x, lastz, last.y, first.x, firstz, first.y);
    for (let i = 0; i < hull.length - 1; i++) {
      const p1 = hull[i];
      const p2 = hull[i + 1];
      line.segment(p1.x, down ? p1.zup : p1.zdown, p1.y, p1.x, down ? p1.zup + p1.zupoff : p1.zdown + p1.zdownoff, p1.y);
      line.segment(p1.x, down ? p1.zup + p1.zupoff : p1.zdown + p1.zdownoff, p1.y, p2.x, down ? p2.zup : p2.zdown, p2.y);
    }
  }
}

export async function DrawWallModule(injector: Injector) {
  const bus = await injector.getInstance(BUS);
  bus.connect(await create(injector, DrawWall, BUILDERS_FACTORY, VIEW, BOARD, REFERENCE_TRACKER, BUS, ART));
}

export class DrawWall extends MessageHandlerReflective {
  private wallId = -1;

  constructor(
    factory: BuildersFactory,
    private view: View,
    private board: BoardProvider,
    private refs: BuildReferenceTracker,
    private bus: MessageBus,
    private art: ArtProvider,
    private portal = new PortalModel(factory, art),
  ) { super() }

  private start() {
    const target = this.view.snapTarget();
    if (target.entity == null || !target.entity.isWall()) return;
    this.portal.start(this.board(), target.entity.id, target.coords[0], target.coords[1], target.coords[2]);
    this.wallId = target.entity.id;
  }

  private insertPoint() {
    if (this.wallId == -1) this.start();
    else this.portal.addPoint();
  }

  private popPoint() {

  }

  public NamedMessage(msg: NamedMessage) {
    switch (msg.name) {
      case 'draw_point': this.insertPoint(); return;
      case 'undo_draw_point': this.popPoint(); return;
    }
  }

  public Frame(msg: Frame) {
    if (this.wallId != -1) {
      const target = this.view.snapTarget();
      this.portal.move(target.coords[0], target.coords[1], target.coords[2])
    }
  }

  public Render(msg: Render) {
    if (this.wallId == -1) return;
    msg.consumer(this.portal.getRenderable());
  }
}