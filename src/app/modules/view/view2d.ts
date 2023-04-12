import { vec3 } from "gl-matrix";
import { closestSpriteInSectorDist, closestWallInSectorDist, closestWallPointDist, closestWallSegmentDist, closestWallSegmentInSectorDist } from "../../../build/board/distances";
import { findSector, inSector, snapWall } from "../../../build/board/query";
import { Board } from "../../../build/board/structs";
import { Entity, Hitscan, Ray, Target, hitscan } from "../../../build/hitscan";
import { ZSCALE, build2gl, getPlayerStart } from "../../../build/utils";
import { CachedValue } from "../../../utils/cachedvalue";
import { Controller2D } from "../../../utils/camera/controller2d";
import { NumberInterpolator } from "../../../utils/interpolator";
import { clamp, int, len2d } from "../../../utils/mathutils";
import { DelayedValue } from "../../../utils/timed";
import { ArtProvider, BoardProvider, BoardUtils, GridController, SnapTarget, SnapTargets, SnapType, State } from "../../apis/app";
import { Renderable } from "../../apis/renderable";
import { BoardInvalidate, LoadBoard } from "../../edit/messages";
import { BuildGl } from "../gl/buildgl";
import { BoardRenderer2D } from "./boardrenderer2d";
import { SnapTargetsImpl, TargetImpl, ViewPosition } from "./view";
import { ViewBase } from "./common";


export class View2d extends ViewBase {
  private position: ViewPosition;
  private control = new Controller2D();
  private pointer = vec3.create();
  private hit = new CachedValue(h => this.updateHitscan(h), new Hitscan());
  private snapTargetsValue = new CachedValue(t => this.updateSnapTargets(t), new SnapTargetsImpl());
  private direction = new CachedValue(r => this.updateDir(r), new Ray());
  private upp = new DelayedValue(100, 1, NumberInterpolator);

  constructor(
    gl: WebGL2RenderingContext,
    offscreen: OffscreenCanvas,
    canvas: HTMLCanvasElement,
    private renderer: BoardRenderer2D,
    private gridController: GridController,
    private buildgl: BuildGl,
    private board: BoardProvider,
    private boardUtils: BoardUtils,
    private art: ArtProvider,
    private state: State
  ) {
    super(gl, offscreen, canvas);
    this.loadBoard(board());
  }

  get sec() { return this.position.sec }
  get x() { return this.position.x }
  get y() { return this.position.y }
  get z() { return this.position.z }

  getProjectionMatrix() { return this.control.getProjectionMatrix() }
  getTransformMatrix() { return this.control.getTransformMatrix() }
  getPosition() { return this.pointer }
  drawTools(renderables: Iterable<Renderable>) { this.renderer.drawTools(renderables) }
  target(): Target { return this.hit.get().target() }
  targets(): Iterable<Target> { return this.hit.get().targets() }
  snapTargets(): SnapTargets { return this.snapTargetsValue.get() }
  dir(): Ray { return this.direction.get() }
  getViewPosition() { return this.position }

  activate(pos: ViewPosition) {
    this.position = pos;
    this.control.setPosition(this.position.x, this.position.y, this.position.z);
  }

  mouse(mx: number, my: number) {
    this.control.track(mx, my, 1024 * ZSCALE, this.state.get('lookaim'));
    const p = this.control.getPointerPosition(this.pointer);

    this.position.x = int(p[0]);
    this.position.y = int(p[2]);
    const board = this.board();
    if (!inSector(board, this.position.x, this.position.y, this.position.sec))
      this.position.sec = findSector(board, this.position.x, this.position.y, this.position.sec);
  }

  protected draw(dt: number) {
    this.control.setSize(this.getCanvas().clientWidth, this.getCanvas().clientHeight);
    this.invalidateTarget();
    const campos = this.control.getPosition();
    const dist = this.control.getMaxDist();
    this.buildgl.newFrame(this.getCanvas());
    this.renderer.draw(this, campos, dist, this.control);
    const cursor = build2gl(vec3.create(), this.snapTargetsValue.get().closest().target.coords);
    this.buildgl.setCursorPosiotion(cursor[0], cursor[1], cursor[2]);

    const state = this.state;
    const zoomUp = state.get('zoom+');
    const zoomDown = state.get('zoom-');
    if (zoomUp) this.upp.set(clamp(this.upp.get() / 1.3, 0.1, 100))
    if (zoomDown) this.upp.set(clamp(this.upp.get() * 1.3, 0.1, 100))
    const upp = this.upp.get();
    if (zoomUp || zoomDown) this.gridController.setGridSize(upp * 16);

    this.control.setUnitsPerPixel(upp);
  }

  private invalidateTarget() {
    this.direction.invalidate();
    this.hit.invalidate();
    this.snapTargetsValue.invalidate();
  }

  BoardInvalidate(msg: BoardInvalidate) {
    this.invalidateTarget();
  }

  LoadBoard(msg: LoadBoard) {
    this.loadBoard(msg.board);
  }

  private loadBoard(board: Board) {
    const sprite = getPlayerStart(board);
    this.position = { x: sprite.x, y: sprite.y, z: sprite.z, sec: sprite.sectnum };
    this.control.setPosition(this.position.x, this.position.y, 1024 * ZSCALE);
    this.invalidateTarget();
  }

  private updateHitscan(hit: Hitscan) {
    hit.reset(this.x, this.y, this.z, 0, 0, -1 * ZSCALE);
    hitscan(this.board(), this.boardUtils, this.art, this.sec, hit, 0);
    return hit;
  }

  private gridTarget = new TargetImpl();
  private gridSnapTraget: SnapTarget = { target: this.gridTarget, type: SnapType.GRID };
  private wallTarget = new TargetImpl();
  private wallSnapTarget: SnapTarget = { target: this.wallTarget, type: SnapType.WALL };
  private pointOnWallTarget = new TargetImpl();
  private pointOnWallSnapTarget: SnapTarget = { target: this.pointOnWallTarget, type: SnapType.POINT_ON_WALL };
  private spriteTarget = new TargetImpl();
  private spriteSnapTarget: SnapTarget = { target: this.spriteTarget, type: SnapType.SPRITE };

  private updateSnapTargets(targets: SnapTargetsImpl): SnapTargetsImpl {
    targets.clear();
    const board = this.board();
    const x = this.x;
    const y = this.y;
    const gx = this.gridController.snap(this.x);
    const gy = this.gridController.snap(this.y);

    vec3.set(this.gridTarget.coords_, gx, gy, 0);
    const sectorId = findSector(board, x, y, this.sec);
    if (sectorId != -1) this.gridTarget.entity_ = Entity.floor(sectorId);
    else this.gridTarget.entity_ = null;
    targets.add(this.gridSnapTraget, len2d(x - gx, y - gy));

    const [wallId,] = sectorId == -1
      ? closestWallSegmentDist(board, x, y)
      : closestWallSegmentInSectorDist(board, sectorId, x, y);
    if (wallId != -1) {
      const [sx, sy] = snapWall(board, wallId, x, y, this.gridController);
      this.pointOnWallTarget.entity_ = Entity.midWall(wallId);
      vec3.set(this.pointOnWallTarget.coords_, sx, sy, 0);
      this.pointOnWallSnapTarget.type = SnapType.POINT_ON_WALL;
      targets.add(this.pointOnWallSnapTarget, len2d(x - sx, y - sy));
    }

    const [wallPointId, wallDist] = sectorId == -1
      ? closestWallPointDist(board, x, y)
      : closestWallInSectorDist(board, sectorId, x, y);
    if (wallPointId != -1) {
      const wall = board.walls[wallPointId];
      this.wallTarget.entity_ = Entity.wallPoint(wallPointId);
      vec3.set(this.wallTarget.coords_, wall.x, wall.y, 0);
      targets.add(this.wallSnapTarget, wallDist);
    }

    const [spriteId, spriteDist] = closestSpriteInSectorDist(board, this.sec, x, y);
    if (spriteId != -1) {
      const sprite = board.sprites[spriteId];
      this.spriteTarget.entity_ = Entity.sprite(spriteId);
      vec3.set(this.spriteTarget.coords_, sprite.x, sprite.y, sprite.z);
      targets.add(this.spriteSnapTarget, spriteDist);
    }

    return targets;
  }

  private updateDir(ray: Ray): Ray {
    vec3.set(ray.start, this.x, this.y, this.z);
    vec3.set(ray.dir, 0, 0, -1 * ZSCALE);
    return ray;
  }
}