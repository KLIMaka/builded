import { closestWallPointDist } from "../../../build/board/distances";
import { sectorWalls } from "../../../build/board/loops";
import { EngineApi } from "../../../build/board/mutations/api";
import { createNewSector } from "../../../build/board/mutations/ceatesector";
import { createInnerLoop } from "../../../build/board/mutations/sectors";
import { splitSector } from "../../../build/board/mutations/splitsector";
import { findContainingSectorMidPoints, sectorOfWall, wallInSector } from "../../../build/board/query";
import { Board } from "../../../build/board/structs";
import { Target } from "../../../build/hitscan";
import { ZSCALE } from "../../../build/utils";
import { vec3 } from "../../../libs_js/glmatrix";
import { Deck, wrap } from "../../../utils/collections";
import { create, Module } from "../../../utils/injector";
import { int, len2d } from "../../../utils/mathutils";
import { ART, ArtProvider, BOARD, BoardProvider, BuildReferenceTracker, ENGINE_API, REFERENCE_TRACKER, View, VIEW } from "../../apis/app";
import { BUS, MessageBus } from "../../apis/handler";
import { NULL_RENDERABLE, Renderable, Renderables } from "../../apis/renderable";
import { writeText } from "../../modules/geometry/builders/common";
import { RenderablesCache, RENDRABLES_CACHE } from "../../modules/geometry/cache";
import { BuildersFactory, BUILDERS_FACTORY } from "../../modules/geometry/common";
import { LineBuilder, PointSpritesBuilder } from "../../modules/gl/buffers";
import { getClosestSectorZ } from "../editutils";
import { BoardInvalidate, COMMIT, Frame, NamedMessage, Render } from "../messages";
import { DefaultTool, TOOLS_BUS } from "./toolsbus";

class Contour {
  private points: Array<[number, number]> = [];
  private size = 0;
  private z = 0;

  constructor(
    factory: BuildersFactory,
    private art: ArtProvider,
    firstPoint: boolean = true,
    private contour = factory.wireframe('utils'),
    private contourPoints = factory.pointSprite('utils'),
    private length = factory.pointSprite('utils'),
    private renderable = new Renderables([contour, contourPoints, length])
  ) { if (firstPoint) this.pushPoint(0, 0) }

  public setZ(z: number) { this.z = z }
  public getZ() { return this.z }
  public pushPoint(x: number, y: number) { this.points[this.size++] = [x, y] }
  public updateLastPoint(x: number, y: number) { this.updatePoint(this.size - 1, x, y) }
  public popPoint() { this.size-- }
  public clear() { this.size = 0 }

  public updatePoint(idx: number, x: number, y: number) {
    if (idx >= this.size) throw new Error('Invalid point id: ' + idx);
    const p = this.points[idx];
    p[0] = x;
    p[1] = y;
  }

  public getRenderable() {
    this.updateRenderable();
    return this.renderable;
  }

  private updateRenderable() {
    if (this.size == 0) return;
    this.updateContourPoints();
    this.updateContour();
    this.updateLength();
  }

  private updateContourPoints() {
    this.contourPoints.needToRebuild();
    this.contourPoints.tex = this.art.get(-1);
    const builder = new PointSpritesBuilder();
    for (let i = 0; i < this.size; i++) {
      const p = this.points[i];
      builder.add(p[0], this.z, p[1]);
    }
    builder.build(this.contourPoints.buff, 2.5);
  }

  private updateContour() {
    this.contour.needToRebuild();
    const buff = this.contour.buff;
    buff.deallocate();
    const size = this.size - 1;
    const builder = new LineBuilder();
    for (let i = 0; i < size; i++) {
      const p1 = this.points[i];
      const p2 = this.points[i + 1];
      builder.segment(p1[0], this.z, p1[1], p2[0], this.z, p2[1]);
    }
    builder.build(buff);
  }

  private prepareLengthLabels(): [number, string[]] {
    let total = 0;
    const labels: string[] = [];
    for (let i = 0; i < this.size - 1; i++) {
      const p = this.points[i];
      const p1 = this.points[i + 1];
      const label = int(len2d(p[0] - p1[0], p[1] - p1[1])) + "";
      labels.push(label);
      total += label.length * 2 + 3;
    }
    return [total, labels];
  }

  private updateLength() {
    this.length.needToRebuild();
    const buff = this.length.buff;
    buff.deallocate();
    if (this.size < 2) return;
    this.length.tex = this.art.get(-2);
    const size = this.size - 1;
    const [total, labels] = this.prepareLengthLabels();
    buff.allocate(total * 4, total * 6);
    let off = 0;
    for (let i = 0; i < size; i++) {
      const p = this.points[i];
      const p1 = this.points[i + 1];
      const label = labels[i];
      writeText(buff, off, label, 8, 8, p[0] + (p1[0] - p[0]) / 2, p[1] + (p1[1] - p[1]) / 2, this.z);
      off += label.length * 2 + 3;
    }
  }
}

export async function DrawSectorModule(module: Module) {
  module.execute(async injector => {
    const bus = await injector.getInstance(TOOLS_BUS);
    bus.connect(await create(injector, DrawSector, BUILDERS_FACTORY, ART, ENGINE_API, VIEW, BOARD, REFERENCE_TRACKER, BUS, RENDRABLES_CACHE));
  });
}

export class DrawSector extends DefaultTool {
  private points = new Deck<[number, number]>();
  private pointer = vec3.create();
  private isRect = true;
  private sectorOverlay: Renderable;

  constructor(
    factory: BuildersFactory,
    art: ArtProvider,
    private api: EngineApi,
    private view: View,
    private board: BoardProvider,
    private refs: BuildReferenceTracker,
    private bus: MessageBus,
    private renderables: RenderablesCache,
    private contour = new Contour(factory, art),
  ) {
    super();
  }

  private update() {
    if (this.predrawUpdate()) return;
    const z = this.contour.getZ();
    const [x, y] = this.view.snapTarget().coords;
    vec3.set(this.pointer, x, y, z);

    if (this.isRect) {
      const fp = this.points.get(0);
      const dx = x - fp[0];
      const dy = y - fp[1];
      const p1 = this.points.get(1);
      const p2 = this.points.get(2);
      const p3 = this.points.get(3);
      p1[0] = fp[0] + dx;
      p2[0] = fp[0] + dx;
      p2[1] = fp[1] + dy;
      p3[1] = fp[1] + dy;
      this.contour.updatePoint(1, fp[0] + dx, fp[1]);
      this.contour.updatePoint(2, fp[0] + dx, fp[1] + dy);
      this.contour.updatePoint(3, fp[0], fp[1] + dy);
    } else {
      this.contour.updateLastPoint(x, y);
    }
  }

  private predrawUpdate() {
    if (this.points.length() > 0) return false;
    const target = this.view.target();
    const snapTarget = this.view.snapTarget();
    const board = this.board();
    if (snapTarget.entity == null) {
      const [x, y] = snapTarget.coords;
      const [w] = closestWallPointDist(board, x, y);
      const z = w == -1 ? 0 : board.sectors[sectorOfWall(board, w)].ceilingz;
      vec3.set(this.pointer, x, y, z);
      this.contour.setZ(z / ZSCALE);
      this.contour.updateLastPoint(x, y);
    } else if (snapTarget.entity.isSector() || snapTarget.entity.isSprite() || (target.entity == null || target.entity.isSector())) {
      const [x, y,] = snapTarget.coords;
      const z = this.getPointerZ(board, snapTarget);
      vec3.set(this.pointer, x, y, z);
      this.contour.setZ(z / ZSCALE);
      this.contour.updateLastPoint(x, y);
    }
    return true;
  }

  private getActiveSectorId(board: Board, target: Target) {
    if (target.entity.isWall()) return sectorOfWall(board, target.entity.id);
    if (target.entity.isSprite()) return board.sprites[target.entity.id].sectnum;
    if (target.entity.isSector()) return target.entity.id;
  }

  private updateOverlay() {
    if (!this.isActive()) return NULL_RENDERABLE;
    const target = this.view.target();
    if (target.entity == null) return NULL_RENDERABLE;
    const board = this.board();
    const sectorId = this.getActiveSectorId(board, target);
    return this.renderables.helpers.sector(sectorId);
  }

  private isSplitSector(x: number, y: number) {
    const sectorId = this.findContainingSector();
    if (sectorId == -1) return -1;
    const fp = this.points.get(0);
    const board = this.board();
    return wallInSector(board, sectorId, fp[0], fp[1]) != -1
      && wallInSector(board, sectorId, x, y) != -1 ? sectorId : -1;
  }

  private insertPoint(rect: boolean) {
    this.activate();
    if (this.points.length() == 0) this.isRect = rect;
    if (this.checkFinish()) {
      this.deactivate();
      return;
    }

    if (this.isRect) {
      for (let i = 0; i < 4; i++) {
        this.points.push([this.pointer[0], this.pointer[1]]);
        this.contour.pushPoint(this.pointer[0], this.pointer[1]);
      }
    } else {
      this.points.push([this.pointer[0], this.pointer[1]]);
      this.contour.pushPoint(this.pointer[0], this.pointer[1]);
    }
  }

  private checkFinish() {
    if (this.points.length() == 0) return false;

    const splitSector = this.isSplitSector(this.pointer[0], this.pointer[1]);
    if (splitSector != -1) {
      this.splitSector(splitSector);
      return true;
    }
    const latsPoint = this.points.get(this.points.length() - 1);
    if (latsPoint[0] == this.pointer[0] && latsPoint[1] == this.pointer[1]) return false;
    const firstPoint = this.points.get(0);
    if (firstPoint[0] == this.pointer[0] && firstPoint[1] == this.pointer[1] || this.isRect) {
      this.createSector();
      return true;
    }
    return false;
  }

  private popPoint() {
    if (this.points.length() == 0) return;
    if (this.isRect) {
      for (let i = 0; i < 4; i++) {
        this.points.pop();
        this.contour.popPoint();
      }
    } else {
      this.points.pop();
      this.contour.popPoint();
    }
    if (this, this.points.length() == 0) this.deactivate();
    this.contour.updateLastPoint(this.pointer[0], this.pointer[1]);
  }

  private getPointerZ(board: Board, target: Target): number {
    if (target.entity.isSector()) return target.coords[2];
    const sectorId = target.entity.isWall() ? sectorOfWall(board, target.entity.id) : board.sprites[target.entity.id].sectnum;
    return getClosestSectorZ(board, sectorId, target.coords[0], target.coords[1], target.coords[2])[1];
  }

  private findContainingSector() {
    const sectors = findContainingSectorMidPoints(this.board(), [...this.points, <[number, number]>this.pointer]);
    return sectors.size == 1 ? sectors.values().next().value : -1;
  }

  private createSector() {
    const sectorId = this.findContainingSector();
    const board = this.board();
    if (sectorId != -1)
      createInnerLoop(board, sectorId, this.points, this.refs, this.api);
    createNewSector(board, this.points, this.refs, this.api);
    this.bus.handle(COMMIT);
    this.bus.handle(new BoardInvalidate(null));
    this.points.clear();
    this.contour.clear();
    this.contour.pushPoint(0, 0);
  }

  private splitSector(sectorId: number): void {
    splitSector(this.board(), sectorId, wrap([...this.points, <[number, number]>this.pointer]), this.refs, this.api);
    this.bus.handle(COMMIT);
    this.bus.handle(new BoardInvalidate(null));
    this.points.clear();
    this.contour.clear();
    this.contour.pushPoint(0, 0);
  }

  public NamedMessage(msg: NamedMessage) {
    switch (msg.name) {
      case 'draw_rect': this.insertPoint(true); return;
      case 'draw': this.insertPoint(false); return;
      case 'undo_draw': this.popPoint(); return;
    }
  }

  public Render(msg: Render) {
    msg.consumer(this.contour.getRenderable());
    if (this.isActive()) msg.consumer(this.updateOverlay());
  }

  public Frame(msg: Frame) { this.update() }
}
