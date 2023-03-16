import { EngineApi } from "../../../build/board/mutations/api";
import { buildHull, drawWall, Point, point_3d, PortalType } from "../../../build/board/mutations/drawwall";
import { sectorOfWall } from "../../../build/board/query";
import { Board } from "../../../build/board/structs";
import { build2gl, createSlopeCalculator, wallNormal, ZSCALE } from "../../../build/utils";
import { vec2, vec3 } from "gl-matrix";
import { create, getInstances, lifecycle, Module, plugin } from "../../../utils/injector";
import { dot2d } from "../../../utils/mathutils";
import { ART, ArtProvider, BOARD, BoardProvider, BuildReferenceTracker, ENGINE_API, GRID, GridController, REFERENCE_TRACKER, SnapType, View, VIEW } from "../../apis/app";
import { BUS, busDisconnector, MessageBus } from "../../apis/handler";
import { Renderables } from "../../apis/renderable";
import { BuildersFactory, BUILDERS_FACTORY } from "../../modules/geometry/common";
import { LineBuilder } from "../../modules/gl/buffers";
import { MovingHandle } from "../handle";
import { BoardInvalidate, Commit, Frame, NamedMessage, Render } from "../messages";
import { DefaultTool, TOOLS_BUS } from "./toolsbus";

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

  private buildHull() {
    return buildHull([...this.points, this.pointer], (x, y) => this.project(x, y));
  }

  public stop(board: Board, art: ArtProvider, refs: BuildReferenceTracker, api: EngineApi, dist: number) {
    drawWall(board, this.wallId, this.type, this.buildHull(), art, refs, api, dist);
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
    const [xp, yp, _] = this.project(x, y);
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

  public hasPoints() {
    return this.points.length != 0;
  }

  public onLastPoint() {
    if (this.points.length == 0) return false;
    const lastPoint = this.points[this.points.length - 1];
    return vec3.exactEquals(lastPoint, this.pointer);
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
    const hull = this.buildHull();
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

export async function DrawWallModule(module: Module) {
  module.bind(plugin('DrawWall'), lifecycle(async (injector, lifecycle) => {
    const [bus] = await getInstances(injector, TOOLS_BUS);
    const drawwall = await create(injector, DrawWall, BUILDERS_FACTORY, ENGINE_API, VIEW, BOARD, REFERENCE_TRACKER, BUS, ART, GRID);
    lifecycle(bus.connect(drawwall), busDisconnector(bus));
  }));
}

export class DrawWall extends DefaultTool {
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
    const target = this.view.target();
    const snapTarget = this.view.snapTarget(SnapType.WALL);
    if (snapTarget.entity == null || target == null || !snapTarget.entity.isWall() && target.entity == null || target.entity.isSector()) return;
    this.activate();
    const [x, y, z] = snapTarget.coords;
    this.portal.start(this.board(), snapTarget.entity.id, x, y, z);
    this.wallId = snapTarget.entity.id;
  }

  private stop() {
    this.portal.stop(this.board(), this.art, this.refs, this.api, this.getDistance());
    this.bus.handle(new Commit(`Draw wall ${this.wallId}`));
    this.wallId = -1;
    this.bus.handle(new BoardInvalidate(null));
    this.movingHandle.stop();
    this.deactivate();
  }

  private abort() {
    this.wallId = -1;
    this.movingHandle.stop();
    this.deactivate();
  }

  private insertPoint() {
    if (this.wallId == -1) this.start();
    else if (this.movingHandle.isActive()) this.stop();
    else if (this.portal.onLastPoint()) this.pushPortal();
    else this.portal.addPoint();
  }

  private popPoint() {
    if (this.wallId == -1) return;
    else {
      this.portal.popPoint();
      if (!this.portal.hasPoints()) this.abort();
    }
  }

  private pushPortal() {
    const target = this.view.snapTarget(SnapType.SECTOR);
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
      case 'draw': this.insertPoint(); return;
      case 'undo_draw': this.popPoint(); return;
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
      const target = this.view.snapTarget(SnapType.SECTOR);
      const [x, y, z] = target.coords;
      this.portal.move(x, y, z);
    }
  }

  public Render(msg: Render) {
    if (this.wallId == -1) return;
    msg.consumer(this.portal.getRenderable(this.getDistance()));
  }
}