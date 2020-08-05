import { Board } from "../../../build/board/structs";
import { createSlopeCalculator, sectorOfWall, ZSCALE } from "../../../build/utils";
import { vec2, Vec2Array } from "../../../libs_js/glmatrix";
import { create, Injector } from "../../../utils/injector";
import { BOARD, BoardProvider, BuildReferenceTracker, REFERENCE_TRACKER, View, VIEW, ART, ArtProvider } from "../../apis/app";
import { BUS, MessageBus, MessageHandlerReflective } from "../../apis/handler";
import { LayeredRenderables } from "../../apis/renderable";
import { BuildersFactory, BUILDERS_FACTORY } from "../../modules/geometry/common";
import { Frame, NamedMessage, Render } from "../messages";
import { LineBuilder } from "../../modules/gl/buffers";

enum PortalType { UP, DOWN, MID };
type point_t = { off: number, zup: number, zdown: number, zref: number };

class PortalModel {
  private wallVec = vec2.create();
  private startPoint = vec2.create();
  private type: PortalType;
  private points: point_t[] = [];
  private placedPoints: point_t[] = [];
  private slope: (x: number, y: number) => number;

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
        this.slope = (x: number, y: number) => curslope(x, y, sector.floorheinum) + sector.floorz;
      } else if (z <= cnz && z >= cz) {
        this.type = PortalType.UP;
        this.slope = (x: number, y: number) => curslope(x, y, sector.ceilingheinum) + sector.ceilingz;
      }
      else throw new Error(`Invalid point`);
    }
    this.move(x, y, z);
    this.addPoint();
  }

  public move(x: number, y: number, z: number) {
    this.points = [...this.placedPoints];
    this.insertPoint(this.points, x, y, z);
  }

  public addPoint() {
    this.placedPoints = [...this.points];
  }

  private getOffset(x: number, y: number) {
    const point = vec2.fromValues(x, y);
    const vec = vec2.sub(vec2.create(), point, this.startPoint);
    return vec2.dot(this.wallVec, vec);
  }

  private findIndex(points: point_t[], off: number) {
    for (let i = 0; i < points.length; i++) if (points[i].off >= off) return i;
    return points.length;
  }

  private createPoint(points: point_t[], idx: number, off: number, z: number): point_t {
    if (idx == 0 || idx == points.length) return { off, zup: z, zdown: z, zref: z };
    const p1 = points[idx - 1];
    const p2 = points[idx];
    const dzup = p2.zup - p1.zup;
    const dzdown = p2.zdown - p1.zdown;
    const doff = (off - p1.off) / (p2.off - p1.off);
    const zup = p1.zup + dzup * doff;
    const zdown = p1.zdown + dzdown * doff;
    return { off, zup: zup <= z ? zup : z, zdown: zdown >= z ? zdown : z, zref: z };
  }

  private updatePoint(p: point_t, z: number) {
    if (z > p.zref) {
      p.zdown = z;
      p.zup = p.zref;
    } else {
      p.zup = z;
      p.zdown = p.zref;
    }
  }

  private insertPoint(points: point_t[], x: number, y: number, z: number) {
    const off = this.getOffset(x, y);
    const idx = this.findIndex(points, off);
    if (idx < points.length && points[idx].off == off) this.updatePoint(points[idx], z);
    else {
      const p = this.createPoint(points, idx, off, z);
      points.splice(idx, 0, p);
    }
  }

  private update() {
    if (this.points.length == 0) return;
    this.updateContour();
    this.updateContourPoints();
  }

  private getCoords(out: Vec2Array, off: number): Vec2Array {
    vec2.copy(out, this.wallVec);
    vec2.scale(out, out, off);
    return vec2.add(out, out, this.startPoint);
  }

  private updateContourPoints() {
    this.contourPoints.needToRebuild();
    this.contourPoints.tex = this.art.get(-1);
    const buff = this.contourPoints.buff;
    const size = this.placedPoints.length;
    buff.allocate(size * 4, size * 6);
    const d = 2.5;
    const p = vec2.create();
    for (let i = 0; i < size; i++) {
      const point = this.placedPoints[i];
      const off = i * 4;
      this.getCoords(p, point.off);
      buff.writePos(off + 0, p[0], this.z, p[1]);
      buff.writePos(off + 1, p[0], this.z, p[1]);
      buff.writePos(off + 2, p[0], this.z, p[1]);
      buff.writePos(off + 3, p[0], this.z, p[1]);
      buff.writeTcLighting(off + 0, 0, 0);
      buff.writeTcLighting(off + 1, 1, 0);
      buff.writeTcLighting(off + 2, 1, 1);
      buff.writeTcLighting(off + 3, 0, 1);
      buff.writeNormal(off + 0, -d, d, 0);
      buff.writeNormal(off + 1, d, d, 0);
      buff.writeNormal(off + 2, d, -d, 0);
      buff.writeNormal(off + 3, -d, -d, 0);
      buff.writeQuad(i * 6, off, off + 1, off + 2, off + 3);
    }
  }

  private updateContour() {
    this.contour.needToRebuild();
    const p1 = vec2.create();
    const p2 = vec2.create();
    const line = new LineBuilder();
    const buff = this.contour.buff;
    const last = this.points[this.points.length - 1];
    const first = this.points[0];
    buff.deallocate();
    if (this.type == PortalType.DOWN) {
      this.getCoords(p1, last.off);
      this.getCoords(p2, first.off);
      line.segment(p1[0], this.slope(p1[0], p1[1]) / ZSCALE, p1[1], p1[0], last.zup / ZSCALE, p1[1]);
      line.segment(p2[0], this.slope(p2[0], p2[1]) / ZSCALE, p2[1], p2[0], first.zup / ZSCALE, p2[1]);
      line.segment(p1[0], this.slope(p1[0], p1[1]) / ZSCALE, p1[1], p2[0], this.slope(p2[0], p2[1]) / ZSCALE, p2[1]);
      for (let i = 1; i < this.points.length; i++) {
        const point1 = this.points[i];
        const point2 = this.points[i + 1];
        this.getCoords(p1, point1.off);
        this.getCoords(p2, point2.off);
        line.segment(p1[0], point1.zup / ZSCALE, p1[1], p2[0], point2.zup / ZSCALE, p2[1]);
      }
    } else if (this.type == PortalType.UP) {

    } else if (this.type == PortalType.MID) {
      this.getCoords(p1, last.off);
      this.getCoords(p2, first.off);
      line.segment(p1[0], last.zdown / ZSCALE, p1[1], p1[0], last.zup / ZSCALE, p1[1]);
      line.segment(p1[0], first.zdown / ZSCALE, p1[1], p1[0], first.zup / ZSCALE, p1[1]);
      for (let i = 0; i < this.points.length - 1; i++) {
        const point1 = this.points[i];
        const point2 = this.points[i + 1];
        this.getCoords(p1, point1.off);
        this.getCoords(p2, point2.off);
        line.segment(p1[0], point1.zup / ZSCALE, p1[1], p2[0], point2.zup / ZSCALE, p2[1]);
        line.segment(p1[0], point1.zdown / ZSCALE, p1[1], p2[0], point2.zdown / ZSCALE, p2[1]);
      }
    }
    line.build(buff);
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