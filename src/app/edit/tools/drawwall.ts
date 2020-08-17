import { Board } from "../../../build/board/structs";
import { createSlopeCalculator, sectorOfWall, ZSCALE } from "../../../build/utils";
import { vec2 } from "../../../libs_js/glmatrix";
import { create, Injector } from "../../../utils/injector";
import { cyclic } from "../../../utils/mathutils";
import { ART, ArtProvider, BOARD, BoardProvider, BuildReferenceTracker, REFERENCE_TRACKER, View, VIEW } from "../../apis/app";
import { BUS, MessageBus, MessageHandlerReflective } from "../../apis/handler";
import { LayeredRenderables } from "../../apis/renderable";
import { BuildersFactory, BUILDERS_FACTORY } from "../../modules/geometry/common";
import { LineBuilder } from "../../modules/gl/buffers";
import { Frame, NamedMessage, Render } from "../messages";
import { loopPairs } from "../../../utils/collections";

enum PointMode { UP, UPOFF, DOWN, DOWNOFF };
class Point {
  constructor(
    readonly off: number,
    readonly x: number,
    readonly y: number,
    public zup: number,
    public zdown: number = zup,
    public zupoff = 0,
    public zdownoff = 0,
    public mode = PointMode.UPOFF
  ) { }

  public updateZ(z: number) {
    if (z >= this.zup) {
      this.zdown = this.zup;
      this.zdownoff = this.zupoff;
      this.zup = z;
      this.zupoff = 0;
    } else {
      this.zdown = z;
      this.zdownoff = 0;
    }
  }

  public updateZVertical(z: number, dz: number) {
    if (z >= this.zup) {
      this.zdown = this.zup;
      this.zdownoff = this.zupoff;
      this.zup = z;
      this.zupoff = dz;
    } else {
      this.zdown = z;
      this.zdownoff = dz;
    }
  }

  public update(z: number) {
    switch (this.mode) {
      case PointMode.UPOFF: this.updateUpOff(z); break;
      case PointMode.UP: this.updateUp(z); break;
      case PointMode.DOWNOFF: this.updateDownOff(z); break;
      case PointMode.DOWN: this.updateDown(z); break;
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

  private updateUp(z: number) {
    const zupoff = this.zup + this.zupoff;
    this.zup = z;
    this.zupoff = zupoff - z;
    this.fixDown();
  }

  private updateUpOff(z: number) {
    this.zupoff = z - this.zup;
    this.fixDown();
  }

  private updateDown(z: number) {
    const zdownoff = this.zdown + this.zdownoff;
    this.zdown = z;
    this.zdownoff = zdownoff - z;
    this.fixUp();
  }

  private updateDownOff(z: number) {
    this.zdownoff = z - this.zdown;
    this.fixUp();
  }

  public setMode(mode: PointMode) {
    this.mode = mode;
  }

  public getModeZ() {
    switch (this.mode) {
      case PointMode.DOWN: return this.zdown;
      case PointMode.DOWNOFF: return this.zdown + this.zdownoff;
      case PointMode.UP: return this.zup;
      case PointMode.UPOFF: return this.zup + this.zupoff;
    }
  }
}

enum PortalType { UP, DOWN, MID };
type point_3d = [number, number, number];

class PortalModel {
  private wallVec = vec2.create();
  private startPoint = vec2.create();
  private type: PortalType;
  private points: Point[] = [];
  private placedPoints: Point[] = [];
  private lastPoint = -1;
  private slope: (x: number, y: number) => number;
  private needToUpdate = true;
  private lastMove: point_3d = [0, 0, 0];
  private modes = [PointMode.UP, PointMode.UPOFF, PointMode.DOWN, PointMode.DOWNOFF];

  constructor(
    factory: BuildersFactory,
    private art: ArtProvider,
    private contour = factory.wireframe('utils'),
    private contourPoints = factory.pointSprite('utils'),
    private length = factory.pointSprite('utils'),
    private renderable = new LayeredRenderables([contour, contourPoints, length])
  ) { }

  public getRenderable() { this.update(); return this.renderable }

  public start(board: Board, wallId: number, x: number, y: number, z: number) {
    this.points = [];
    this.placedPoints = [];
    this.lastPoint = -1;
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

  private buildHull(points: point_3d[]) {
    const hull: Point[] = [];
    for (const [x, y, _] of points) {
      const [xp, yp, off] = this.project(x, y);
      const idx = this.findIndex(hull, off);
      if (idx == hull.length || hull[idx].off != off) hull.splice(idx, 0, new Point(off, xp, yp, 0));
    }

    for (const [p1, p2] of loopPairs(points)) {
      const vertical = p1[0] == p2[0] && p1[1] == p2[1];
      let dz = p2[2] - p1[2];
      let z = 0;
      let pp1 = this.project(p1[0], p1[1]);
      let pp2 = this.project(p2[0], p2[1]);
      [pp1, pp2, dz, z] = pp1[2] > pp2[2] ? [pp2, pp1, -dz, p2[2]] : [pp1, pp2, dz, p1[2]];
      let idx = this.findIndex(hull, pp1[2]);
      if (vertical) {
        hull[idx].updateZVertical(p1[2], dz);
      } else {
        while (hull[idx].off != pp2[2]) {
          const doff = (hull[idx].off - p1[2]) / (p2[2] - p1[2]);
          hull[idx].updateZ(z + doff * dz)
          idx++;
        }
      }
    }

    return hull;
  }

  private project(x: number, y: number): point_3d {
    const point = vec2.fromValues(x, y);
    const vec = vec2.sub(vec2.create(), point, this.startPoint);
    const off = vec2.dot(this.wallVec, vec);
    const t = vec2.copy(vec2.create(), this.wallVec);
    vec2.scale(t, t, off);
    vec2.add(t, t, this.startPoint);
    return [t[0], t[1], off];
  }

  private clonePlacedPoints() {
    const pts = [];
    for (let i = 0; i < this.placedPoints.length; i++) {
      const p = new Point(0, 0, 0, 0);
      Object.assign(p, this.placedPoints[i]);
      pts.push(p)
    }
    return pts;
  }

  public move(x: number, y: number, z: number) {
    const [xp, yp, off] = this.project(x, y);
    if (this.needToMove(xp, yp, z)) return;
    this.points = this.clonePlacedPoints();
    this.insertPoint(this.points, xp, yp, z / ZSCALE, off);
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
    this.placedPoints = [...this.points];
    const lastPoint = this.points[this.lastPoint];
    const lastMode = lastPoint.mode;
    const nextMode = cyclic(this.modes.indexOf(lastMode) + 1, this.modes.length);
    lastPoint.setMode(nextMode);
    this.needToUpdate = true;
  }


  private findIndex(points: Point[], off: number) {
    for (let i = 0; i < points.length; i++) if (points[i].off >= off) return i;
    return points.length;
  }

  private createPoint(points: Point[], idx: number, off: number, x: number, y: number, z: number): Point {
    if (idx == 0 || idx == points.length) return new Point(off, x, y, z);
    const p1 = points[idx - 1];
    const p2 = points[idx];
    const dzup = p2.zup - p1.zup - p1.zupoff;
    const dzdown = p2.zdown - p1.zdown - p1.zdownoff;
    const doff = (off - p1.off) / (p2.off - p1.off);
    const zup = p1.zup + p1.zupoff + dzup * doff;
    const zdown = p1.zdown + p1.zdownoff + dzdown * doff;
    return new Point(off, x, y, zup, z >= zup ? zup : z);
  }

  private updatePoint(points: Point[], idx: number, z: number) {
    points[idx].update(z);
  }

  private insertPoint(points: Point[], x: number, y: number, z: number, off: number) {
    const idx = this.findIndex(points, off);
    if (idx < points.length && points[idx].off == off) {
      this.updatePoint(points, idx, z);
    } else if (idx == 0 || idx == points.length) {
      const p = this.createPoint(points, idx, off, x, y, z);
      points.splice(idx, 0, p);
    }
    this.lastPoint = idx;
    this.needToUpdate = true;
  }

  private update() {
    if (!this.needToUpdate) return;
    if (this.points.length == 0) return;
    this.updateContour();
    this.updateContourPoints();
    this.needToUpdate = false;
  }

  private updateContourPoints() {
  }

  private updateContour() {
    this.contour.needToRebuild();
    const line = new LineBuilder();
    const last = this.points[this.points.length - 1];
    const first = this.points[0];
    if (this.type == PortalType.DOWN) this.buildNonMid(line, last, first, true);
    else if (this.type == PortalType.UP) this.buildNonMid(line, last, first, false);
    else if (this.type == PortalType.MID) this.buildMid(line, last, first);

    const size = 16;
    const lastPoint = this.points[this.lastPoint];
    const dw = vec2.scale(vec2.create(), this.wallVec, size);
    const x = lastPoint.x;
    const y = lastPoint.y;
    const z = lastPoint.getModeZ();
    line.rect(
      x - dw[0], z - size, y - dw[1],
      x + dw[0], z - size, y - dw[1],
      x + dw[0], z + size, y - dw[1],
      x - dw[0], z + size, y - dw[1],
    )
    if (lastPoint.mode == PointMode.UP) line.segment(x, z, y, x, z + size, y);
    if (lastPoint.mode == PointMode.UPOFF) line.segment(x, z, y, x + dw[0], z + size, y + dw[1]);
    if (lastPoint.mode == PointMode.DOWN) line.segment(x, z, y, x, z - size, y);
    if (lastPoint.mode == PointMode.DOWNOFF) line.segment(x, z, y, x + dw[0], z - size, y + dw[1]);

    line.build(this.contour.buff);
  }

  private buildMid(line: LineBuilder, last: Point, first: Point) {
    line.segment(last.x, last.zdown, last.y, last.x, last.zup, last.y);
    line.segment(first.x, first.zdown, first.y, first.x, first.zup, first.y);
    for (let i = 0; i < this.points.length - 1; i++) {
      const p1 = this.points[i];
      const p2 = this.points[i + 1];
      line.segment(p1.x, p1.zup, p1.y, p1.x, p1.zup + p1.zupoff, p1.y);
      line.segment(p1.x, p1.zdown, p1.y, p1.x, p1.zdown + p1.zdownoff, p1.y);
      line.segment(p1.x, p1.zup + p1.zupoff, p1.y, p2.x, p2.zup, p2.y);
      line.segment(p1.x, p1.zdown + p1.zdownoff, p1.y, p2.x, p2.zdown, p2.y);
    }
  }

  private buildNonMid(line: LineBuilder, last: Point, first: Point, down: boolean) {
    const lastz = this.slope(last.x, last.y);
    const firstz = this.slope(first.x, first.y);
    line.segment(last.x, lastz, last.y, last.x, down ? last.zup : last.zdown, last.y);
    line.segment(first.x, firstz, first.y, first.x, down ? first.zup : first.zdown, first.y);
    line.segment(last.x, lastz, last.y, first.x, firstz, first.y);
    for (let i = 0; i < this.points.length - 1; i++) {
      const p1 = this.points[i];
      const p2 = this.points[i + 1];
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
    this.portal.getRenderable().accept(msg.consumer);
  }
}