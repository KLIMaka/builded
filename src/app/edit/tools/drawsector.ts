import { createInnerLoop, createNewSector, splitSector, wallInSector } from "../../../build/boardutils";
import { Target } from "../../../build/hitscan";
import { Board } from "../../../build/structs";
import { findSector, sectorOfWall, ZSCALE } from "../../../build/utils";
import { vec3 } from "../../../libs_js/glmatrix";
import { Deck, fastIterator } from "../../../utils/collections";
import { Injector, create } from "../../../utils/injector";
import { int, len2d } from "../../../utils/mathutils";
import { MessageHandlerReflective, MessageBus, BUS } from "../../apis/handler";
import { LayeredRenderables } from "../../apis/renderable";
import { writeText } from "../../modules/geometry/builders/common";
import { BuildersFactory, BUILDERS_FACTORY } from "../../modules/geometry/common";
import { getClosestSectorZ } from "../editutils";
import { BoardInvalidate, Frame, NamedMessage, Render } from "../messages";
import { ArtProvider, View, BuildReferenceTracker, ART, VIEW, BOARD, REFERENCE_TRACKER, BoardProvider } from "../../apis/app";

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
    private renderable = new LayeredRenderables(fastIterator([contour, contourPoints, length]))
  ) { if (firstPoint) this.pushPoint(0, 0) }

  public setZ(z: number) { this.z = z }
  public getZ() { return this.z }
  public pushPoint(x: number, y: number) { this.points[this.size++] = [x, y] }
  public updateLastPoint(x: number, y: number) { this.updatePoint(this.size - 1, x, y) }
  public popPoint() { this.size-- }
  public clear() { this.size = 0 }

  public updatePoint(idx: number, x: number, y: number) {
    if (idx >= this.size) throw new Error('Invalid point id: ' + idx);
    let p = this.points[idx];
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
    let buff = this.contourPoints.buff;
    buff.allocate(this.size * 4, this.size * 6);
    let d = 2.5;
    for (let i = 0; i < this.size; i++) {
      let p = this.points[i];
      let off = i * 4;
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
    let buff = this.contour.buff;
    buff.deallocate();
    let size = this.size - 1;
    buff.allocate(size + 1, size * 2);

    for (let i = 0; i < size; i++) {
      let p = this.points[i];
      buff.writePos(i, p[0], this.z, p[1]);
      buff.writeLine(i * 2, i, i + 1);
    }
    buff.writePos(size, this.points[size][0], this.z, this.points[size][1]);
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
    let size = this.size - 1;
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

export async function DrawSectorModule(injector: Injector) {
  const bus = await injector.getInstance(BUS);
  bus.connect(await create(injector, DrawSector, BUILDERS_FACTORY, ART, VIEW, BOARD, REFERENCE_TRACKER, BUS));
}

export class DrawSector extends MessageHandlerReflective {
  private points = new Deck<[number, number]>();
  private pointer = vec3.create();
  private hintSector = -1;
  private valid = false;
  private isRect = true;

  constructor(
    factory: BuildersFactory,
    art: ArtProvider,
    private view: View,
    private board: BoardProvider,
    private refs: BuildReferenceTracker,
    private bus: MessageBus,
    private contour = new Contour(factory, art)
  ) { super() }

  private update() {
    if (this.predrawUpdate()) return;

    let z = this.contour.getZ();
    const [x, y] = this.view.snapTarget().coords;
    vec3.set(this.pointer, x, y, z);

    if (this.isRect) {
      let fp = this.points.get(0);
      let dx = x - fp[0];
      let dy = y - fp[1];
      let p1 = this.points.get(1);
      let p2 = this.points.get(2);
      let p3 = this.points.get(3);
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
    const target = this.view.snapTarget();
    if (target.entity == null) {
      this.valid = false;
    } else {
      this.valid = true;
      let [x, y,] = target.coords;
      const board = this.board();
      let z = this.getPointerZ(board, target);
      vec3.set(this.pointer, x, y, z);
      this.contour.setZ(z / ZSCALE);
      this.contour.updateLastPoint(x, y);
      if (target.entity.isSector()) this.hintSector = target.entity.id;
      if (target.entity.isSprite()) this.hintSector = board.sprites[target.entity.id].sectnum;
      if (target.entity.isWall()) this.hintSector = sectorOfWall(board, target.entity.id);
    }
    return true;
  }

  private isSplitSector(x: number, y: number) {
    let sectorId = this.findContainingSector();
    if (sectorId == -1) return -1;
    let fp = this.points.get(0);
    const board = this.board();
    return wallInSector(board, sectorId, fp[0], fp[1]) != -1
      && wallInSector(board, sectorId, x, y) != -1 ? sectorId : -1;
  }

  private insertPoint(rect: boolean) {
    if (this.points.length() == 0) this.isRect = rect;
    if (!this.valid) return;
    if (this.checkFinish()) return;

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

    let splitSector = this.isSplitSector(this.pointer[0], this.pointer[1]);
    if (splitSector != -1) {
      this.points.push([this.pointer[0], this.pointer[1]]);
      this.splitSector(splitSector);
      return true;
    }
    let latsPoint = this.points.get(this.points.length() - 1);
    if (latsPoint[0] == this.pointer[0] && latsPoint[1] == this.pointer[1]) return;
    let firstPoint = this.points.get(0);
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
    this.contour.updateLastPoint(this.pointer[0], this.pointer[1]);
  }

  private getPointerZ(board: Board, target: Target): number {
    if (target.entity.isSector()) return target.coords[2];
    let sectorId = target.entity.isWall() ? sectorOfWall(board, target.entity.id) : board.sprites[target.entity.id].sectnum;
    return getClosestSectorZ(board, sectorId, target.coords[0], target.coords[1], target.coords[2])[1];
  }

  private findContainingSector() {
    let sectorId = this.hintSector;
    for (let p of this.points) {
      let s = findSector(this.board(), p[0], p[1], sectorId);
      if (s != sectorId) return -1;
    }
    return sectorId;
  }

  private createSector() {
    let sectorId = this.findContainingSector();
    const board = this.board();
    if (sectorId != -1)
      createInnerLoop(board, sectorId, this.points, this.refs);
    createNewSector(board, this.points, this.refs);
    // ctx.commit();
    this.bus.handle(new BoardInvalidate(null));
    this.points.clear();
    this.contour.clear();
    this.contour.pushPoint(0, 0);
  }

  private splitSector(sectorId: number) {
    if (splitSector(this.board(), sectorId, this.points, this.refs) != -1) {
      // ctx.commit();
      this.bus.handle(new BoardInvalidate(null));
    }
    this.points.clear();
    this.contour.clear();
    this.contour.pushPoint(0, 0);
  }

  public NamedMessage(msg: NamedMessage) {
    switch (msg.name) {
      case 'draw_rect_wall': this.insertPoint(true); return;
      case 'draw_wall': this.insertPoint(false); return;
      case 'undo_draw_wall': this.popPoint(); return;
    }
  }

  public Frame(msg: Frame) {
    this.update();
  }

  public Render(msg: Render, ) {
    this.contour.getRenderable().accept(msg.consumer);
  }
}
