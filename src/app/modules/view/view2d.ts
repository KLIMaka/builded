import { closestSpriteInSector, closestWallPoint, closestWallSegment } from "../../../build/boardutils";
import { Entity, EntityType, Hitscan, hitscan, Ray, Target } from "../../../build/hitscan";
import { Board } from "../../../build/board/structs";
import { findSector, getPlayerStart, inSector, ZSCALE } from "../../../build/utils";
import { vec3 } from "../../../libs_js/glmatrix";
import { CachedValue } from "../../../utils/cachedvalue";
import { Controller2D } from "../../../utils/camera/controller2d";
import { Injector } from "../../../utils/injector";
import { NumberInterpolator } from "../../../utils/interpolator";
import { int, len2d } from "../../../utils/mathutils";
import { DelayedValue } from "../../../utils/timed";
import { ART, ArtProvider, BOARD, BoardProvider, STATE, State, View, GridController, GRID } from "../../apis/app";
import { Message, MessageHandlerReflective } from "../../apis/handler";
import { HintRenderable, RenderableProvider } from "../../apis/renderable";
import { BoardInvalidate, LoadBoard, Mouse } from "../../edit/messages";
import { GL } from "../buildartprovider";
import { BuildGl, BUILD_GL } from "../gl/buildgl";
import { BoardRenderer2D, Renderer2D } from "./boardrenderer2d";
import { snapWall, TargetImpl, ViewPosition } from "./view";


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
  private position: ViewPosition;
  private control = new Controller2D();
  private pointer = vec3.create();
  private hit = new CachedValue((h: Hitscan) => this.updateHitscan(h), new Hitscan());
  private snapTargetValue = new CachedValue((t: TargetImpl) => this.updateSnapTarget(t), new TargetImpl());
  private direction = new CachedValue((r: Ray) => this.updateDir(r), new Ray());
  private upp = new DelayedValue(100, 1, NumberInterpolator);

  constructor(
    readonly gl: WebGLRenderingContext,
    private renderer: BoardRenderer2D,
    private gridController: GridController,
    private buildgl: BuildGl,
    private board: BoardProvider,
    private art: ArtProvider,
    private state: State
  ) {
    super();

    state.register('zoom+', false);
    state.register('zoom-', false);

    this.loadBoard(board());
  }

  get sec() { return this.position.sec }
  get x() { return this.position.x }
  get y() { return this.position.y }
  get z() { return this.position.z }

  getProjectionMatrix() { return this.control.getProjectionMatrix() }
  getTransformMatrix() { return this.control.getTransformMatrix() }
  getPosition() { return this.pointer }
  drawTools(renderable: RenderableProvider<HintRenderable>) { this.renderer.drawTools(this.gl, renderable) }
  target(): Target { return this.hit.get() }
  snapTarget(): Target { return this.snapTargetValue.get() }
  dir(): Ray { return this.direction.get() }
  isWireframe() { return true }
  getViewPosition() { return this.position }

  activate(pos: ViewPosition) {
    this.position = pos;
    this.control.setPosition(this.position.x, this.position.y, this.position.z);
  }

  Mouse(msg: Mouse) {
    this.control.track(msg.x, msg.y, 1024 * ZSCALE, this.state.get('lookaim'));
    const x = (msg.x / this.gl.drawingBufferWidth) * 2 - 1;
    const y = (msg.y / this.gl.drawingBufferHeight) * 2 - 1;
    const p = this.control.getPointerPosition(this.pointer, x, y);

    this.position.x = int(p[0]);
    this.position.y = int(p[2]);
    const board = this.board();
    if (!inSector(board, this.position.x, this.position.y, this.position.sec))
      this.position.sec = findSector(board, this.position.x, this.position.y, this.position.sec);
  }

  Frame(msg: Message) {
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
    const sprite = getPlayerStart(board);
    this.position = { x: sprite.x, y: sprite.y, z: sprite.z, sec: sprite.sectnum };
    this.control.setPosition(this.position.x, this.position.y, 1024 * ZSCALE);
    this.invalidateTarget();
  }

  private updateHitscan(hit: Hitscan) {
    hitscan(this.board(), this.art, this.x, this.y, this.z, this.sec, 0, 0, -1 * ZSCALE, hit, 0);
    return hit;
  }

  private updateSnapTarget(target: TargetImpl) {
    const board = this.board();
    const d = this.gridController.getGridSize() / 2;
    const s = closestSpriteInSector(board, this.sec, this.x, this.y, d);
    if (s != -1) {
      const sprite = board.sprites[s];
      target.coords_[0] = sprite.x
      target.coords_[1] = sprite.y;
      target.coords_[2] = sprite.z;
      target.entity_ = new Entity(s, EntityType.SPRITE);
      return target;
    }
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