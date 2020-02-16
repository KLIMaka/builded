import { int, len2d } from "../../../../../libs/mathutils";
import { vec3 } from "../../../../../libs_js/glmatrix";
import { Deck, fastIterator } from "../../../../collections";
import { BuildContext, Target } from "../../api";
import { createInnerLoop, createNewSector, splitSector, wallInSector } from "../../boardutils";
import { writeText } from "../../gl/builders/common";
import { LayeredRenderables, PointSpriteBuilder, WireframeBuilder } from "../../gl/builders/renderable";
import { MessageHandlerReflective } from "../../handlerapi";
import { Board } from "../../structs";
import { findSector, sectorOfWall, ZSCALE } from "../../utils";
import { getClosestSectorZ } from "../editutils";
import { BoardInvalidate, Frame, NamedMessage, Render } from "../messages";

class Contour {
  private points: Array<[number, number]> = [];
  private size = 0;
  private z = 0;
  private contour = new WireframeBuilder();
  private contourPoints = new PointSpriteBuilder();
  private length = new PointSpriteBuilder();
  private renderable = new LayeredRenderables(fastIterator([this.contour, this.contourPoints, this.length]));

  constructor(firstPoint: boolean = true) { if (firstPoint) this.pushPoint(0, 0) }

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

  public getRenderable(ctx: BuildContext) {
    this.updateRenderable(ctx);
    return this.renderable;
  }

  private updateRenderable(ctx: BuildContext) {
    if (this.size == 0) return;
    this.updateContourPoints(ctx);
    this.updateContour();
    this.updateLength(ctx);
  }

  private updateContourPoints(ctx: BuildContext) {
    this.contourPoints.tex = ctx.art.get(-1);
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
      buff.writeTc(off + 0, 0, 0);
      buff.writeTc(off + 1, 1, 0);
      buff.writeTc(off + 2, 1, 1);
      buff.writeTc(off + 3, 0, 1);
      buff.writeNormal(off + 0, -d, d, 0);
      buff.writeNormal(off + 1, d, d, 0);
      buff.writeNormal(off + 2, d, -d, 0);
      buff.writeNormal(off + 3, -d, -d, 0);
      buff.writeQuad(i * 6, off, off + 1, off + 2, off + 3);
    }
  }

  private updateContour() {
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

  private updateLength(ctx: BuildContext) {
    const buff = this.length.buff;
    buff.deallocate();
    if (this.size < 2) return;
    this.length.tex = ctx.art.get(-2);
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

export class DrawSector extends MessageHandlerReflective {

  private points = new Deck<[number, number]>();
  private pointer = vec3.create();
  private hintSector = -1;
  private valid = false;
  private contour = new Contour();
  private isRect = true;

  private update(ctx: BuildContext) {
    if (this.predrawUpdate(ctx)) return;

    let z = this.contour.getZ();
    const [x, y] = ctx.view.snapTarget().coords;
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

  private predrawUpdate(ctx: BuildContext) {
    if (this.points.length() > 0) return false;
    const target = ctx.view.snapTarget();
    if (target.entity == null) {
      this.valid = false;
    } else {
      this.valid = true;
      let [x, y,] = target.coords;
      let z = this.getPointerZ(ctx.board, target);
      vec3.set(this.pointer, x, y, z);
      this.contour.setZ(z / ZSCALE);
      this.contour.updateLastPoint(x, y);
      if (target.entity.isSector()) this.hintSector = target.entity.id;
      if (target.entity.isSprite()) this.hintSector = ctx.board.sprites[target.entity.id].sectnum;
      if (target.entity.isWall()) this.hintSector = sectorOfWall(ctx.board, target.entity.id);
    }
    return true;
  }

  private isSplitSector(ctx: BuildContext, x: number, y: number) {
    let sectorId = this.findContainingSector(ctx);
    if (sectorId == -1) return -1;
    let fp = this.points.get(0);
    return wallInSector(ctx.board, sectorId, fp[0], fp[1]) != -1 && wallInSector(ctx.board, sectorId, x, y) != -1 ? sectorId : -1;
  }

  private insertPoint(ctx: BuildContext, rect: boolean) {
    if (this.points.length() == 0) this.isRect = rect;
    if (!this.valid) return;
    if (this.checkFinish(ctx)) return;

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

  private checkFinish(ctx: BuildContext) {
    if (this.points.length() == 0) return false;

    let splitSector = this.isSplitSector(ctx, this.pointer[0], this.pointer[1]);
    if (splitSector != -1) {
      this.points.push([this.pointer[0], this.pointer[1]]);
      this.splitSector(ctx, splitSector);
      return true;
    }
    let latsPoint = this.points.get(this.points.length() - 1);
    if (latsPoint[0] == this.pointer[0] && latsPoint[1] == this.pointer[1]) return;
    let firstPoint = this.points.get(0);
    if (firstPoint[0] == this.pointer[0] && firstPoint[1] == this.pointer[1] || this.isRect) {
      this.createSector(ctx);
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

  private findContainingSector(ctx: BuildContext) {
    let sectorId = this.hintSector;
    for (let p of this.points) {
      let s = findSector(ctx.board, p[0], p[1], sectorId);
      if (s != sectorId) return -1;
    }
    return sectorId;
  }

  private createSector(ctx: BuildContext) {
    let sectorId = this.findContainingSector(ctx);
    if (sectorId != -1)
      createInnerLoop(ctx.board, sectorId, this.points, ctx.refs);
    createNewSector(ctx.board, this.points, ctx.refs);
    ctx.commit();
    ctx.message(new BoardInvalidate(null));
    this.points.clear();
    this.contour.clear();
    this.contour.pushPoint(0, 0);
  }

  private splitSector(ctx: BuildContext, sectorId: number) {
    if (splitSector(ctx.board, sectorId, this.points, ctx.refs) != -1) {
      ctx.commit();
      ctx.message(new BoardInvalidate(null));
    }
    this.points.clear();
    this.contour.clear();
    this.contour.pushPoint(0, 0);
  }

  public NamedMessage(msg: NamedMessage, ctx: BuildContext) {
    switch (msg.name) {
      case 'draw_rect_wall': this.insertPoint(ctx, true); return;
      case 'draw_wall': this.insertPoint(ctx, false); return;
      case 'undo_draw_wall': this.popPoint(); return;
    }
  }

  public Frame(msg: Frame, ctx: BuildContext) {
    this.update(ctx);
  }

  public Render(msg: Render, ctx: BuildContext) {
    this.contour.getRenderable(ctx).accept(msg.consumer);
  }
}
