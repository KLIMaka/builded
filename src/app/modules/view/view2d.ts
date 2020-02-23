import { closestWallPoint, closestWallSegment } from "../../../build/boardutils";
import { Entity, EntityType, Hitscan, hitscan, Ray, Target } from "../../../build/hitscan";
import { Board, Sprite } from "../../../build/structs";
import { findSector, getPlayerStart, inSector, ZSCALE } from "../../../build/utils";
import { vec3 } from "../../../libs_js/glmatrix";
import { CachedValue } from "../../../utils/cachedvalue";
import { Controller2D } from "../../../utils/camera/controller2d";
import { Injector } from "../../../utils/injector";
import { NumberInterpolator } from "../../../utils/interpolator";
import { int, len2d } from "../../../utils/mathutils";
import { DelayedValue } from "../../../utils/timed";
import { ART, ArtProvider, BOARD, STATE, State, View, BoardProvider } from "../../apis/app";
import { Message, MessageHandlerReflective } from "../../apis/handler";
import { Renderable } from "../../apis/renderable";
import { BoardInvalidate, Mouse, LoadBoard } from "../../edit/messages";
import { GL } from "../buildartprovider";
import { GRID, GridController } from "../context";
import { BuildGl, BUILD_GL } from "../gl/buildgl";
import { BoardRenderer2D, Renderer2D } from "./boardrenderer2d";
import { snapWall, TargetImpl } from "./view";


export async function View2dConstructor(injector: Injector) {
  const [gl, renderer, grid, bgl, board, art, state] = await Promise.all([
    injector.getInstance(GL),
    Renderer2D(injector),
    injector.getInstance(GRID),
    injector.getInstance(BUILD_GL),
    injector.getInstance(BOARD),
    injector.getInstance(ART),
    injector.getInstance(STATE),
  ]);
  return new View2d(gl, renderer, grid, bgl, board, art, state);
}

export class View2d extends MessageHandlerReflective implements View {
  readonly gl: WebGLRenderingContext;
  private playerstart: Sprite;
  private control = new Controller2D();
  private pointer = vec3.create();
  private hit = new CachedValue((h: Hitscan) => this.updateHitscan(h), new Hitscan());
  private snapTargetValue = new CachedValue((t: TargetImpl) => this.updateSnapTarget(t), new TargetImpl());
  private direction = new CachedValue((r: Ray) => this.updateDir(r), new Ray());
  private gridController: GridController;
  private upp = new DelayedValue(100, 1, NumberInterpolator);
  private buildgl: BuildGl;
  private renderer: BoardRenderer2D;
  private board: BoardProvider;
  private art: ArtProvider;
  private state: State;

  constructor(gl: WebGLRenderingContext, renderer: BoardRenderer2D, gridController: GridController, buildgl: BuildGl, board: BoardProvider, art: ArtProvider, state: State) {
    super();
    this.gl = gl;
    this.gridController = gridController;
    this.buildgl = buildgl;
    this.renderer = renderer;
    this.board = board;
    this.art = art;
    this.state = state;

    state.register('zoom+', false);
    state.register('zoom-', false);

    this.loadBoard(board());
  }

  get sec() { return this.playerstart.sectnum }
  get x() { return this.playerstart.x }
  get y() { return this.playerstart.y }
  get z() { return this.playerstart.z }

  getProjectionMatrix() { return this.control.getProjectionMatrix() }
  getTransformMatrix() { return this.control.getTransformMatrix() }
  getPosition() { return this.pointer }
  activate() { this.control.setPosition(this.playerstart.x, this.playerstart.y, 1024 * ZSCALE) }
  draw(renderable: Renderable) { this.buildgl.draw(this.gl, renderable) }
  target(): Target { return this.hit.get() }
  snapTarget(): Target { return this.snapTargetValue.get() }
  dir(): Ray { return this.direction.get() }
  isWireframe() { return true }

  Mouse(msg: Mouse) {
    if (this.playerstart == null) return;

    this.control.track(msg.x, msg.y, 1024 * ZSCALE, this.state.get('lookaim'));
    const x = (msg.x / this.gl.drawingBufferWidth) * 2 - 1;
    const y = (msg.y / this.gl.drawingBufferHeight) * 2 - 1;
    const p = this.control.getPointerPosition(this.pointer, x, y);

    this.playerstart.x = int(p[0]);
    this.playerstart.y = int(p[2]);
    const board = this.board();
    if (!inSector(board, this.playerstart.x, this.playerstart.y, this.playerstart.sectnum))
      this.playerstart.sectnum = findSector(board, this.playerstart.x, this.playerstart.y, this.playerstart.sectnum);
  }

  Frame(msg: Message) {
    if (this.playerstart == null) return;

    this.invalidateTarget();
    this.control.setSize(this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);
    const max = this.control.getPointerPosition(this.pointer, 1, 1);
    const campos = this.control.getPosition();
    const dist = len2d(max[0] - campos[0], max[2] - campos[2]);
    this.buildgl.newFrame(this.gl);
    this.renderer.draw(this, campos, dist, this.control);

    const state = this.state;
    if (state.get('zoom+')) { this.upp.set(this.upp.get() / 1.3); this.recalcGridSize(); }
    if (state.get('zoom-')) { this.upp.set(this.upp.get() * 1.3); this.recalcGridSize(); }

    this.control.setUnitsPerPixel(this.upp.get());
  }

  private recalcGridSize() {
    this.gridController.setGridSize((this.control.getUnitsPerPixel() + 0.5) * 32);
  }

  private invalidateTarget() {
    this.snapTargetValue.invalidate();
    this.direction.invalidate();
    this.hit.invalidate();
  }

  BoardInvalidate(msg: BoardInvalidate) {
    this.invalidateTarget();
  }

  LoadBoard(msg: LoadBoard) {
    this.loadBoard(msg.board);
  }

  private loadBoard(board: Board) {
    this.playerstart = getPlayerStart(board);
    this.control.setPosition(this.playerstart.x, this.playerstart.y, 1024 * ZSCALE);
    this.invalidateTarget();
  }

  private updateHitscan(hit: Hitscan) {
    hitscan(this.board(), this.art, this.x, this.y, this.z, this.sec, 0, 0, -1 * ZSCALE, hit, 0);
    return hit;
  }

  private updateSnapTarget(target: TargetImpl) {
    const board = this.board();
    const d = this.gridController.getGridSize() / 2;
    const w = closestWallPoint(board, this.x, this.y, d);
    if (w != -1) {
      const wall = board.walls[w];
      target.coords_[0] = wall.x
      target.coords_[1] = wall.y;
      target.entity_ = new Entity(w, EntityType.WALL_POINT);
      return target;
    }
    const ws = closestWallSegment(board, this.x, this.y, d);
    if (ws != -1) {
      const [x, y] = snapWall(ws, this.x, this.y, board, this.gridController);
      target.coords_[0] = x;
      target.coords_[1] = y;
      target.entity_ = new Entity(ws, EntityType.MID_WALL);
      return target;
    }
    target.coords_[0] = this.gridController.snap(this.x);
    target.coords_[1] = this.gridController.snap(this.y);
    const sectorId = findSector(board, this.x, this.y, this.sec);
    target.entity_ = sectorId == -1 ? null : new Entity(sectorId, EntityType.FLOOR);
    return target;
  }

  private updateDir(ray: Ray): Ray {
    vec3.set(ray.start, this.x, this.y, this.z);
    vec3.set(ray.dir, 0, 0, -1 * ZSCALE);
    return ray;
  }
}