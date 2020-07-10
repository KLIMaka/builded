import { Board } from "../../../build/board/structs";
import { build2gl, createSlopeCalculator, sectorOfWall, ZSCALE } from "../../../build/utils";
import { vec3, vec2, Vec2Array } from "../../../libs_js/glmatrix";
import { Deck } from "../../../utils/collections";
import { View } from "../../apis/app";
import { MessageHandlerReflective } from "../../apis/handler";
import { LayeredRenderables } from "../../apis/renderable";
import { BuildersFactory } from "../../modules/geometry/common";
import { MovingHandle } from "../handle";
import { Frame, NamedMessage, Render } from "../messages";

const target_ = vec3.create();
const start_ = vec3.create();
const dir_ = vec3.create();

enum PortalType { UP, DOWN, MID };
type point_t = { off: number, zup: number, zdown: number };

class PortalModel {
  private wallId: number;
  private wallVec = vec2.create();
  private startPoint = vec2.create();
  private type: PortalType;
  private points: point_t[] = [];
  private placedPoints: point_t[] = [];
  private slope: (x: number, y: number) => number;

  constructor(
    factory: BuildersFactory,
    private contour = factory.wireframe('utils'),
    private contourPoints = factory.pointSprite('utils'),
    private length = factory.pointSprite('utils'),
    private renderable = new LayeredRenderables([contour, contourPoints, length])
  ) { }

  public getRenderable() { this.update(); return this.renderable }

  public start(board: Board, wallId: number, x: number, y: number, z: number) {
    this.wallId = wallId;
    const wall = board.walls[wallId];
    const wall2 = board[wall.point2];
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

  private createPoint(points: point_t[], idx: number, off: number, z: number) {
    if (idx == 0 || idx == points.length) return { off, zup: z, zdown: z };
    const p1 = points[idx - 1];
    const p2 = points[idx];
    const dzup = p2.zup - p1.zup;
    const dzdown = p2.zdown - p1.zdown;
    const doff = (off - p1.off) / (p2.off - p1.off);
    const zup = p1.zup + dzup * doff;
    const zdown = p1.zdown + dzdown * doff;
    return { off, zup: zup <= z ? zup : z, zdown: zdown >= z ? zdown : z };
  }

  private insertPoint(points: point_t[], x: number, y: number, z: number) {
    const off = this.getOffset(x, y);
    const idx = this.findIndex(points, off);
    if (idx < points.length && points[idx].off == off) {
      const p = points[idx];
      if (z > p.zdown) p.zdown = z;
      else p.zup = z;
    } else {
      const p = this.createPoint(points, idx, off, z);
      points.splice(idx, 0, p);
    }
  }

  private update() {
    if (this.points.length == 0) return;

  }

  private getCoords(out: Vec2Array, off: number): Vec2Array {
    vec2.copy(out, this.wallVec);
    vec2.scale(out, out, off);
    return vec2.add(out, out, this.startPoint);
  }

  private updateContour() {
    this.contour.needToRebuild();
    const p = vec2.create();
    const buff = this.contour.buff;
    buff.deallocate();
    if (this.type == PortalType.DOWN) {
      const size = this.points.length - 1 + 4;
      buff.allocate(size, size * 2 - 2);
      this.getCoords(p, this.points[this.points.length - 1].off);
      buff.writePos(0, p[0], this.slope(p[0], p[1]) / ZSCALE, p[1]);
      buff.writePos(1, p[0], this.points[this.points.length - 1].zup / ZSCALE, p[1]);
      buff.writeLine(0, 0, 1);
      this.getCoords(p, this.points[0].off);
      buff.writePos(2, p[0], this.slope(p[0], p[1]) / ZSCALE, p[1]);
      buff.writePos(3, p[0], this.points[0].zup / ZSCALE, p[1]);
      buff.writeLine(2, 2, 3);
      buff.writeLine(4, 0, 2);
      for (let i = 1; i < this.points.length; i++) {
        const point = this.points[i];
        this.getCoords(p, point.off);
        buff.writePos(4 + i, p[0], point.zup / ZSCALE, p[1]);
        buff.writeLine(6 + i * 2, i + 3, i + 4);
      }
    } else if (this.type == PortalType.UP) {

    } else if (this.type == PortalType.MID) {
      const size = this.points.length - 1 + 4;
      buff.allocate(size, size * 2 - 4);
      this.getCoords(p, this.points[this.points.length - 1].off);
      buff.writePos(0, p[0], this.points[this.points.length - 1].zdown / ZSCALE, p[1]);
      buff.writePos(1, p[0], this.points[this.points.length - 1].zup / ZSCALE, p[1]);
      buff.writeLine(0, 0, 1);
      this.getCoords(p, this.points[0].off);
      buff.writePos(2, p[0], this.points[0].zdown / ZSCALE, p[1]);
      buff.writePos(3, p[0], this.points[0].zup / ZSCALE, p[1]);
      buff.writeLine(2, 2, 3);
      for (let i = 1; i < this.points.length; i++) {
        const point = this.points[i];
        this.getCoords(p, point.off);
        buff.writePos(4 + i, p[0], point.zup / ZSCALE, p[1]);
        buff.writeLine(6 + i * 2, i + 3, i + 4);
      }
    }
  }
}

export class DrawWall extends MessageHandlerReflective {
  private wallId = -1;
  private movingHandle = new MovingHandle();
  private upper = new Deck<number>();
  private lower = new Deck<number>();
  private points = new Deck<[number, number]>();

  constructor(
    factory: BuildersFactory,
    private wireframe = factory.wireframe('utils'),
    private view: View,
  ) { super() }

  private start() {
    const target = this.view.snapTarget();
    if (target.entity == null || !target.entity.isWall()) return;
    this.wallId = target.entity.id;
    this.movingHandle.start(build2gl(target_, target.coords));
  }

  private insertPoint() {
    if (this.wallId == -1) this.start();

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
    if (this.movingHandle.isActive()) {
      const { start, dir } = this.view.dir();
      this.movingHandle.update(false, false, build2gl(start_, start), build2gl(dir_, dir));
    }
  }

  public Render(msg: Render) {
    if (!this.movingHandle.isActive()) return;
    this.wireframe.accept(msg.consumer);
  }
}