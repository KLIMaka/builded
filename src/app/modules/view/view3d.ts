import { closestWallInSector, closestWallSegmentInSector } from "../../../build/board/distances";
import { findSector, inSector, sectorOfWall, snapWall } from "../../../build/board/query";
import { Board } from "../../../build/board/structs";
import { Entity, EntityType, Hitscan, hitscan, Ray, Target } from "../../../build/hitscan";
import { build2gl, getPlayerStart, gl2build, ZSCALE } from "../../../build/utils";
import { vec3 } from "../../../libs_js/glmatrix";
import { CachedValue } from "../../../utils/cachedvalue";
import { Controller3D } from "../../../utils/camera/controller3d";
import { getInstances, lifecycle } from "../../../utils/injector";
import { NumberInterpolator } from "../../../utils/interpolator";
import { int } from "../../../utils/mathutils";
import { DelayedValue } from "../../../utils/timed";
import { ART, ArtProvider, BOARD, BoardProvider, BoardUtils, BOARD_UTILS, GRID, GridController, STATE, State, View } from "../../apis/app";
import { MessageHandlerReflective } from "../../apis/handler";
import { Renderable } from "../../apis/renderable";
import { BoardInvalidate, Frame, LoadBoard, Mouse, NamedMessage } from "../../edit/messages";
import { BuildGl, BUILD_GL } from "../gl/buildgl";
import { Boardrenderer3D, Renderer3D } from "./boardrenderer3d";
import { TargetImpl, ViewPosition } from "./view";

export const View3dConstructor = lifecycle(async (injector, lifecycle) => {
  const [buildgl, board, boardUtils, state, grid, art] = await getInstances(injector, BUILD_GL, BOARD, BOARD_UTILS, STATE, GRID, ART);
  const renderer = await Renderer3D(injector);
  const view = new View3d(renderer, buildgl, board, boardUtils, state, grid, art);
  const stateCleaner = async (s: string) => state.unregister(s);
  lifecycle(state.register('forward', false), stateCleaner);
  lifecycle(state.register('backward', false), stateCleaner);
  lifecycle(state.register('strafe_left', false), stateCleaner);
  lifecycle(state.register('strafe_right', false), stateCleaner);
  lifecycle(state.register('camera_speed', 8000), stateCleaner);
  return view;
});

export class View3d extends MessageHandlerReflective implements View {
  private position: ViewPosition;
  private aspect: number;
  private control = new Controller3D();
  private mouseX = 0;
  private mouseY = 0;
  private hit = new CachedValue((h: Hitscan) => this.updateHitscan(h), new Hitscan());
  private snapTargetValue = new CachedValue((t: TargetImpl) => this.updateSnapTarget(t), new TargetImpl());
  private direction = new CachedValue((r: Ray) => this.updateDir(r), new Ray());
  private cursor = vec3.create();
  private forwardDamper = new DelayedValue(100, 0, NumberInterpolator);
  private sideDamper = new DelayedValue(100, 0, NumberInterpolator);

  constructor(
    private renderer: Boardrenderer3D,
    private buildgl: BuildGl,
    private board: BoardProvider,
    private boardUtils: BoardUtils,
    private state: State,
    private gridController: GridController,
    private art: ArtProvider
  ) {
    super();

    this.aspect = this.buildgl.gl.drawingBufferWidth / this.buildgl.gl.drawingBufferHeight;
    this.control.setFov(90);

    this.loadBoard(board());
  }

  get sec() { return this.position.sec }
  get x() { return this.position.x }
  get y() { return this.position.y }
  get z() { return this.position.z }

  getProjectionMatrix() { return this.control.getProjectionMatrix(this.aspect) }
  getTransformMatrix() { return this.control.getTransformMatrix() }
  getPosition() { return this.control.getPosition() }
  getForward() { return this.control.getForward() }
  drawTools(renderables: Iterable<Renderable>) { this.renderer.drawTools(renderables) }
  target(): Target { return this.hit.get() }
  snapTarget(): Target { return this.snapTargetValue.get() }
  dir(): Ray { return this.direction.get() }
  getViewPosition() { return this.position }

  activate(pos: ViewPosition) {
    this.position = pos;
    this.control.setPosition(this.position.x, this.position.z / ZSCALE + 1024, this.position.y);
  }

  Mouse(msg: Mouse) {
    this.mouseX = msg.x;
    this.mouseY = msg.y;
    this.control.track(msg.x, msg.y, this.state.get('lookaim'));
  }

  Frame(msg: Frame) {
    this.invalidateTarget();
    build2gl(this.cursor, this.snapTarget().coords);
    this.aspect = this.buildgl.gl.drawingBufferWidth / this.buildgl.gl.drawingBufferHeight;
    this.buildgl.setCursorPosiotion(this.cursor[0], this.cursor[1], this.cursor[2]);
    this.buildgl.newFrame();
    this.renderer.draw(this);
    this.move(msg.dt / 1000);
  }

  private move(dt: number) {
    const state = this.state;
    const cameraSpeed = state.get<number>('camera_speed');

    this.forwardDamper.set(0);
    this.sideDamper.set(0);
    if (state.get('forward')) this.forwardDamper.set(1);
    if (state.get('backward')) this.forwardDamper.set(-1);
    if (state.get('strafe_left')) this.sideDamper.set(-1);
    if (state.get('strafe_right')) this.sideDamper.set(1);
    this.control.moveForward(dt * cameraSpeed * this.forwardDamper.get());
    this.control.moveSideway(dt * cameraSpeed * this.sideDamper.get());

    const board = this.board();
    const p = this.control.getPosition();
    this.position.x = int(p[0]);
    this.position.y = int(p[2]);
    this.position.z = int(p[1] * ZSCALE);
    if (!inSector(board, this.position.x, this.position.y, this.position.sec))
      this.position.sec = findSector(board, this.position.x, this.position.y, this.position.sec);
  }

  NamedMessage(msg: NamedMessage) {
    if (msg.name == 'print_info') this.buildgl.printInfo();
    if (msg.name == 'center') this.control.getCamera().setAngles(0, 0);
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
    this.control.setPosition(this.position.x, this.position.z / ZSCALE + 1024, this.position.y);
    this.invalidateTarget();
  }

  private invalidateTarget() {
    this.snapTargetValue.invalidate();
    this.direction.invalidate();
    this.hit.invalidate();
  }

  private updateHitscan(hit: Hitscan): Target {
    const { start, dir } = this.dir();
    hitscan(this.board(), this.boardUtils, this.art, start[0], start[1], start[2], this.sec, dir[0], dir[1], dir[2], hit, 0);
    return hit;
  }

  private getClosestWall(target: Target, d: number): number {
    const [x, y] = target.coords;
    const board = this.board();
    if (target.entity.isWall())
      return closestWallInSector(board, sectorOfWall(board, target.entity.id), x, y, d);
    else if (target.entity.isSector())
      return closestWallInSector(board, target.entity.id, x, y, d);
    return -1;
  }

  private snapGrid(target: Target, t: TargetImpl) {
    t.coords_[0] = this.gridController.snap(target.coords[0]);
    t.coords_[1] = this.gridController.snap(target.coords[1]);
    t.coords_[2] = this.gridController.snap(target.coords[2]);
    t.entity_ = target.entity.clone();
    return t;
  }

  private snapWall(coords: number[], type: EntityType, wallId: number, t: TargetImpl) {
    const [x, y] = snapWall(this.board(), wallId, coords[0], coords[1], this.gridController);
    t.coords_[0] = x;
    t.coords_[1] = y;
    t.coords_[2] = this.gridController.snap(coords[2] / ZSCALE) * ZSCALE;
    t.entity_ = new Entity(wallId, type);
    return t;
  }

  private snapWallPoint(target: Target, wallId: number, t: TargetImpl) {
    const wall = this.board().walls[wallId];
    t.coords_[0] = wall.x;
    t.coords_[1] = wall.y;
    t.coords_[2] = target.coords[2];
    t.entity_ = new Entity(wallId, EntityType.WALL_POINT);
    return t;
  }

  private snapSprite(target: Target, t: TargetImpl) {
    const sprite = this.board().sprites[target.entity.id];
    t.coords_[0] = sprite.x;
    t.coords_[1] = sprite.y;
    t.coords_[2] = sprite.z;
    t.entity_ = target.entity.clone();
    return t;
  }

  private copyTarget(target: Target, t: TargetImpl) {
    t.coords_[0] = target.coords[0];
    t.coords_[1] = target.coords[1];
    t.coords_[2] = target.coords[2];
    t.entity_ = null;
    return t;
  }

  private updateSnapTarget(t: TargetImpl): Target {
    const target = this.target();
    if (target.entity == null) return this.copyTarget(target, t);
    const d = this.gridController.getGridSize() / 8;
    const w = this.getClosestWall(target, d);
    if (w != -1) {
      return this.snapWallPoint(target, w, t);
    } else if (target.entity.isSector()) {
      const w = closestWallSegmentInSector(this.board(), target.entity.id, target.coords[0], target.coords[1], d);
      return w == -1 ? this.snapGrid(target, t) : this.snapWall(target.coords, target.entity.type == EntityType.FLOOR ? EntityType.LOWER_WALL : EntityType.UPPER_WALL, w, t);
    } else if (target.entity.isSprite()) {
      return this.snapSprite(target, t);
    } else if (target.entity.isWall()) {
      return this.snapWall(target.coords, target.entity.type, target.entity.id, t);
    }
  }

  private updateDir(r: Ray): Ray {
    vec3.set(r.start, this.x, this.y, this.z);
    const x = (this.mouseX / this.buildgl.gl.drawingBufferWidth) * 2 - 1;
    const y = (this.mouseY / this.buildgl.gl.drawingBufferHeight) * 2 - 1;
    gl2build(r.dir, this.control.getForwardUnprojected(this.aspect, x, y));
    return r;
  }
}