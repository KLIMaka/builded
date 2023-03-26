import { vec3 } from "gl-matrix";
import { findSector, inSector, snapWall } from "../../../build/board/query";
import { Board } from "../../../build/board/structs";
import { Entity, Hitscan, Ray, Target, hitscan } from "../../../build/hitscan";
import { ZSCALE, build2gl, getPlayerStart, gl2build } from "../../../build/utils";
import { CachedValue } from "../../../utils/cachedvalue";
import { Controller3D } from "../../../utils/camera/controller3d";
import { NumberInterpolator } from "../../../utils/interpolator";
import { int, len2d, len3d } from "../../../utils/mathutils";
import { DelayedValue } from "../../../utils/timed";
import { ArtProvider, BoardProvider, BoardUtils, GridController, SnapTarget, SnapTargets, SnapType, State, View } from "../../apis/app";
import { MessageHandlerReflective } from "../../apis/handler";
import { Renderable } from "../../apis/renderable";
import { BoardInvalidate, Frame, LoadBoard, Mouse, NamedMessage } from "../../edit/messages";
import { BuildGl } from "../gl/buildgl";
import { Boardrenderer3D } from "./boardrenderer3d";
import { SnapTargetsImpl, TargetImpl, ViewPosition } from "./view";

export class View3d extends MessageHandlerReflective implements View {
  private position: ViewPosition;
  private aspect: number;
  private control = new Controller3D();
  private mouseX = 0;
  private mouseY = 0;
  private hit = new CachedValue((h: Hitscan) => this.updateHitscan(h), new Hitscan());
  private snapTargetsValue = new CachedValue(t => this.updateSnapTargets(t), new SnapTargetsImpl());
  private direction = new CachedValue((r: Ray) => this.updateDir(r), new Ray());
  private cursor = vec3.create();
  private forwardDamper = new DelayedValue(100, 0, NumberInterpolator);
  private sideDamper = new DelayedValue(100, 0, NumberInterpolator);

  constructor(
    private canvas: HTMLCanvasElement,
    private renderer: Boardrenderer3D,
    private buildgl: BuildGl,
    private board: BoardProvider,
    private boardUtils: BoardUtils,
    private state: State,
    private gridController: GridController,
    private art: ArtProvider
  ) {
    super();

    this.updateAspectRatio();
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
  target(): Target { return this.hit.get().target() }
  targets(): Iterable<Target> { return this.hit.get().targets() }
  snapTargets(): SnapTargets { return this.snapTargetsValue.get() }
  dir(): Ray { return this.direction.get() }
  getViewPosition() { return this.position }


  activate(pos: ViewPosition) {
    this.position = pos;
    this.control.setPosition(this.position.x, this.position.z / ZSCALE + 1024, this.position.y);
  }

  Mouse(msg: Mouse) {
    this.mouseX = msg.x;
    this.mouseY = msg.y;
    // console.log(this.state.get('lookaim'));
    this.control.track(msg.x, msg.y, this.state.get('lookaim'));
  }

  Frame(msg: Frame) {
    this.updateAspectRatio();
    this.invalidateTarget();
    build2gl(this.cursor, this.snapTargetsValue.get().closest().target.coords);
    this.buildgl.setCursorPosiotion(this.cursor[0], this.cursor[1], this.cursor[2]);
    this.buildgl.newFrame(this.canvas);
    this.renderer.draw(this);
    this.move(msg.dt / 1000);
  }

  private updateAspectRatio() {
    this.aspect = this.canvas.clientWidth / this.canvas.clientHeight;
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
    this.direction.invalidate();
    this.hit.invalidate();
    this.snapTargetsValue.invalidate();
  }

  private updateHitscan(hit: Hitscan): Hitscan {
    const { start, dir } = this.dir();
    const fwd = gl2build(vec3.create(), this.getForward());
    hit.reset(start[0], start[1], start[2], dir[0], dir[1], dir[2], fwd[0], fwd[1], fwd[2]);
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
    const { entity, coords } = this.target();
    const [x, y, z] = coords;
    const gx = this.gridController.snap(x);
    const gy = this.gridController.snap(y);
    const gz = this.gridController.snap(z);

    if (entity == null) {
      this.gridTarget.entity_ = null;
      vec3.set(this.gridTarget.coords_, gx, gy, gz);
      targets.add(this.gridSnapTraget, len3d(x - gx, y - gy, z - gz));
    } else if (entity.isSector()) {
      this.gridTarget.entity_ = entity.clone();
      vec3.set(this.gridTarget.coords_, gx, gy, gz);
      targets.add(this.gridSnapTraget, len3d(x - gx, y - gy, z - gz));


    } else if (entity.isWall()) {
      const [sx, sy] = snapWall(this.board(), entity.id, x, y, this.gridController);
      const wall = board.walls[entity.id];
      const wall2 = board.walls[wall.point2];
      vec3.set(this.wallTarget.coords_, sx, sy, this.gridController.snap(coords[2] / ZSCALE) * ZSCALE);
      if (sx == wall.x && sy == wall.y) {
        this.wallTarget.entity_ = Entity.wallPoint(entity.id);
        this.wallSnapTarget.type = SnapType.WALL;
      } else if (sx == wall2.x && sy == wall2.y) {
        this.wallTarget.entity_ = Entity.wallPoint(wall.point2);
        this.wallSnapTarget.type = SnapType.WALL;
      } else {
        this.wallTarget.entity_ = entity.clone();
        this.wallSnapTarget.type = SnapType.POINT_ON_WALL;
      }
      targets.add(this.wallSnapTarget, len2d(x - sx, y - sy));
    } else if (entity.isSprite()) {
      this.spriteTarget.entity_ = entity.clone();
      const sprite = board.sprites[entity.id];
      vec3.set(this.spriteTarget.coords_, sprite.x, sprite.y, sprite.z);
      targets.add(this.spriteSnapTarget, len3d(x - sprite.x, y - sprite.y, z - sprite.z));
    }

    return targets;
  }

  private updateDir(r: Ray): Ray {
    vec3.set(r.start, this.x, this.y, this.z);
    const x = (this.mouseX / this.canvas.clientWidth) * 2 - 1;
    const y = (this.mouseY / this.canvas.clientHeight) * 2 - 1;
    gl2build(r.dir, this.control.getForwardUnprojected(this.aspect, x, y));
    return r;
  }
}