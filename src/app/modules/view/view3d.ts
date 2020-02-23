import { closestWallInSector, closestWallSegmentInSector } from "../../../build/boardutils";
import { Entity, EntityType, Hitscan, hitscan, Ray, Target } from "../../../build/hitscan";
import { Board, Sprite } from "../../../build/structs";
import { build2gl, findSector, getPlayerStart, gl2build, inSector, sectorOfWall, ZSCALE } from "../../../build/utils";
import { vec3 } from "../../../libs_js/glmatrix";
import { CachedValue } from "../../../utils/cachedvalue";
import { Controller3D } from "../../../utils/camera/controller3d";
import { Injector } from "../../../utils/injector";
import { NumberInterpolator } from "../../../utils/interpolator";
import { int } from "../../../utils/mathutils";
import { DelayedValue } from "../../../utils/timed";
import { ART, ArtProvider, BOARD, STATE, State, View, BoardProvider } from "../../apis/app";
import { MessageHandlerReflective } from "../../apis/handler";
import { Renderable, HintRenderable, RenderableProvider } from "../../apis/renderable";
import { BoardInvalidate, Frame, Mouse, NamedMessage, LoadBoard } from "../../edit/messages";
import { GL } from "../buildartprovider";
import { GRID, GridController } from "../context";
import { BuildGl, BUILD_GL } from "../gl/buildgl";
import { Boardrenderer3D, Renderer3D } from "./boardrenderer3d";
import { snapWall, TargetImpl } from "./view";

export async function View3dConstructor(injector: Injector) {
  const [gl, renderer, buildgl, board, state, grid, art] = await Promise.all([
    injector.getInstance(GL),
    Renderer3D(injector),
    injector.getInstance(BUILD_GL),
    injector.getInstance(BOARD),
    injector.getInstance(STATE),
    injector.getInstance(GRID),
    injector.getInstance(ART),
  ]);
  return new View3d(gl, renderer, buildgl, board, state, grid, art);
}

export class View3d extends MessageHandlerReflective implements View {
  readonly gl: WebGLRenderingContext;
  private playerstart: Sprite;
  private aspect: number;
  private control = new Controller3D();
  private mouseX = 0;
  private mouseY = 0;
  private hit = new CachedValue((h: Hitscan) => this.updateHitscan(h), new Hitscan());
  private snapTargetValue = new CachedValue((t: TargetImpl) => this.updateSnapTarget(t), new TargetImpl());
  private direction = new CachedValue((r: Ray) => this.updateDir(r), new Ray());
  private cursor = vec3.create();
  private forwardDamper = new DelayedValue(50, 0, NumberInterpolator);
  private sideDamper = new DelayedValue(50, 0, NumberInterpolator);
  private buildgl: BuildGl;
  private renderer: Boardrenderer3D;
  private board: BoardProvider;
  private gridController: GridController;
  private state: State;
  private art: ArtProvider;

  constructor(gl: WebGLRenderingContext, renderer: Boardrenderer3D, buildgl: BuildGl, board: BoardProvider, state: State, gridController: GridController, art: ArtProvider) {
    super();
    this.gl = gl;
    this.renderer = renderer;
    this.buildgl = buildgl;
    this.board = board;
    this.gridController = gridController;
    this.state = state;
    this.art = art;

    this.aspect = this.gl.drawingBufferWidth / this.gl.drawingBufferHeight;
    this.control.setFov(90);

    state.register('forward', false);
    state.register('backward', false);
    state.register('strafe_left', false);
    state.register('strafe_right', false);
    state.register('camera_speed', 8000);

    this.loadBoard(board());
  }

  get sec() { return this.playerstart.sectnum }
  get x() { return this.playerstart.x }
  get y() { return this.playerstart.y }
  get z() { return this.playerstart.z }

  getProjectionMatrix() { return this.control.getProjectionMatrix(this.aspect) }
  getTransformMatrix() { return this.control.getTransformMatrix() }
  getPosition() { return this.control.getPosition() }
  getForward() { return this.control.getForward() }
  activate() { this.control.setPosition(this.playerstart.x, this.playerstart.z / ZSCALE + 1024, this.playerstart.y) }
  drawTools(provider: RenderableProvider<HintRenderable>) { this.renderer.drawTools(this.gl, provider) }
  target(): Target { return this.hit.get() }
  snapTarget(): Target { return this.snapTargetValue.get() }
  dir(): Ray { return this.direction.get() }

  Mouse(msg: Mouse) {
    this.mouseX = msg.x;
    this.mouseY = msg.y;
    this.control.track(msg.x, msg.y, this.state.get('lookaim'));
  }

  Frame(msg: Frame) {
    this.invalidateTarget();
    build2gl(this.cursor, this.snapTarget().coords);
    this.buildgl.setCursorPosiotion(this.cursor[0], this.cursor[1], this.cursor[2]);
    this.aspect = this.gl.drawingBufferWidth / this.gl.drawingBufferHeight;
    this.buildgl.newFrame(this.gl);
    this.renderer.draw(this);

    const state = this.state;
    const dt = msg.dt;
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
    this.playerstart.x = int(p[0]);
    this.playerstart.y = int(p[2]);
    this.playerstart.z = int(p[1] * ZSCALE);
    if (!inSector(board, this.playerstart.x, this.playerstart.y, this.playerstart.sectnum))
      this.playerstart.sectnum = findSector(board, this.playerstart.x, this.playerstart.y, this.playerstart.sectnum);
  }

  NamedMessage(msg: NamedMessage) {
    if (msg.name == 'print_info') this.buildgl.printInfo();
  }

  BoardInvalidate(msg: BoardInvalidate) {
    this.invalidateTarget();
  }

  LoadBoard(msg: LoadBoard) {
    this.loadBoard(msg.board);
  }

  private loadBoard(board: Board) {
    this.playerstart = getPlayerStart(board);
    this.control.setPosition(this.playerstart.x, this.playerstart.z / ZSCALE + 1024, this.playerstart.y);
    this.invalidateTarget();
  }

  private invalidateTarget() {
    this.snapTargetValue.invalidate();
    this.direction.invalidate();
    this.hit.invalidate();
  }

  private updateHitscan(hit: Hitscan): Target {
    const { start, dir } = this.dir();
    hitscan(this.board(), this.art, start[0], start[1], start[2], this.sec, dir[0], dir[1], dir[2], hit, 0);
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

  private snapWall(target: Target, wallId: number, t: TargetImpl) {
    const [x, y] = snapWall(wallId, target.coords[0], target.coords[1], this.board(), this.gridController);
    t.coords_[0] = x;
    t.coords_[1] = y;
    t.coords_[2] = target.coords[2];
    t.entity_ = new Entity(wallId, EntityType.MID_WALL);
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
    const d = this.gridController.getGridSize() / 2;
    const w = this.getClosestWall(target, d);
    if (w != -1) {
      return this.snapWallPoint(target, w, t);
    } else if (target.entity.isSector()) {
      const w = closestWallSegmentInSector(this.board(), target.entity.id, target.coords[0], target.coords[1], d);
      return w == -1 ? this.snapGrid(target, t) : this.snapWall(target, w, t);
    } else if (target.entity.isSprite()) {
      return this.snapSprite(target, t);
    } else if (target.entity.isWall()) {
      return this.snapWall(target, target.entity.id, t);
    }
  }

  private updateDir(r: Ray): Ray {
    vec3.set(r.start, this.x, this.y, this.z);
    const x = (this.mouseX / this.gl.drawingBufferWidth) * 2 - 1;
    const y = (this.mouseY / this.gl.drawingBufferHeight) * 2 - 1;
    gl2build(r.dir, this.control.getForwardUnprojected(this.aspect, x, y));
    return r;
  }
}