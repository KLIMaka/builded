import { vec3 } from "gl-matrix";
import { Deck, EMPTY_COLLECTION, filter, forEach } from "utils/collections";
import { Comparator, SortedHeap } from "utils/list";
import { EMPTY_TARGET, Entity, Ray, Target } from "../../../build/hitscan";
import { Dependency, getInstances, lifecycle, Module, Plugin, provider } from "../../../utils/injector";
import { ART, ArtProvider, BOARD, BoardProvider, BoardUtils, BOARD_UTILS, EMPLY_SNAP_TARGETS as EMPTY_SNAP_TARGETS, GRID, GridController, SnapTarget, SnapTargets, SnapType, STATE, State, VIEW, View } from "../../apis/app";
import { BUS, busDisconnector, Message, MessageBus, MessageHandler, MessageHandlerReflective } from "../../apis/handler";
import { Renderable } from "../../apis/renderable";
import { Frame, Key, LoadBoard, Mouse, NamedMessage, PreFrame, Render } from "../../edit/messages";
import { OFFSCREEN } from "../buildartprovider";
import { BuildGl, BUILD_GL } from "../gl/buildgl";
import { BoardRenderer2D, Renderer2D } from "./boardrenderer2d";
import { Boardrenderer3D, Renderer3D } from "./boardrenderer3d";
import { View2d } from "./view2d";
import { View3d } from "./view3d";

export class TargetImpl implements Target {
  public coords_ = vec3.create();
  public entity_: Entity = null;
  get coords() { return this.coords_ }
  get entity() { return this.entity_ }
}

const SNAP_TARGET_ORDER: Comparator<SnapTarget> = (lh, rh) => lh.type - rh.type;
export class SnapTargetsImpl implements SnapTargets {
  private targets = new SortedHeap<SnapTarget>(SNAP_TARGET_ORDER);
  get(): SnapTarget[] { return [... this.targets.get()] }
  getByType(...types: SnapType[]): SnapTarget[] { return [...filter(this.targets.get(), t => types.includes(t.type))] }
  closest(): SnapTarget { return this.targets.first() }
  clear(): void { this.targets.clear() }
  add(target: SnapTarget, dist: number) { this.targets.add(target, dist) }
}

export interface ViewPosition {
  x: number;
  y: number;
  z: number;
  sec: number;
}

export enum ViewType {
  VIEW_2D, VIEW_3D
}

export interface ViewController {
  add(canvas: HTMLCanvasElement, type: ViewType): void;
  currentView(): View;
}

export const VIEW_CONTROLLER = new Dependency<ViewController>('View Controller');

export function SwappableViewModule(module: Module) {
  module.bind(VIEW_CONTROLLER, ViewControllerConstructor);
  module.bind(VIEW, ViewConstructor);
}

// const SwappableViewConstructor: Plugin<View> = lifecycle(async (injector, lifecycle) => {
//   const [bus, state] = await getInstances(injector, BUS, STATE);
//   const view = await create(injector, SwappableView, GRID, VIEW_2D, VIEW_3D);
//   lifecycle(bus.connect(view), busDisconnector(bus));
//   return view;
// });

const ViewControllerConstructor: Plugin<ViewController> = lifecycle(async (injector, lifecycle) => {
  const [bus, offscreen, buildgl, board, boardUtils, state, grid, art] = await getInstances(injector, BUS, OFFSCREEN, BUILD_GL, BOARD, BOARD_UTILS, STATE, GRID, ART);
  const renderer2d = await Renderer2D(injector);
  const renderer3d = await Renderer3D(injector);
  const ctl = new ViewControllerImpl(bus, offscreen, buildgl, board, boardUtils, state, grid, art, renderer2d, renderer3d);
  const stateCleaner = async (s: string) => state.unregister(s);
  lifecycle(state.register('lookaim', false), stateCleaner);
  lifecycle(state.register('forward', false), stateCleaner);
  lifecycle(state.register('backward', false), stateCleaner);
  lifecycle(state.register('strafe_left', false), stateCleaner);
  lifecycle(state.register('strafe_right', false), stateCleaner);
  lifecycle(state.register('camera_speed', 8000), stateCleaner);
  lifecycle(state.register('zoom+', false), stateCleaner);
  lifecycle(state.register('zoom-', false), stateCleaner);
  lifecycle(bus.connect(ctl), busDisconnector(bus));
  return ctl;
});

const VOID_RAY = new Ray();
class ViewImpl implements View {
  constructor(private ctl: ViewController) { }

  drawTools(renderables: Iterable<Renderable>): void {
  }

  private or<T>(value: () => T, def: T) {
    return this.ctl.currentView() == null
      ? def
      : value();
  }

  get sec() { return this.or(() => this.ctl.currentView().sec, -1) }
  get x() { return this.or(() => this.ctl.currentView().x, 0) }
  get y() { return this.or(() => this.ctl.currentView().y, 0) }
  get z() { return this.or(() => this.ctl.currentView().z, 0) }

  target() { return this.or(() => this.ctl.currentView().target(), EMPTY_TARGET) }
  targets() { return this.or(() => this.ctl.currentView().targets(), EMPTY_COLLECTION) }
  snapTargets() { return this.or(() => this.ctl.currentView().snapTargets(), EMPTY_SNAP_TARGETS) }
  dir() { return this.or(() => this.ctl.currentView().dir(), VOID_RAY) }

  handle(message: Message): void {
  }
}

const ViewConstructor: Plugin<View> = provider(async injector => {
  const [ctl] = await getInstances(injector, VIEW_CONTROLLER);
  return new ViewImpl(ctl);
});

class SwappableView implements View, MessageHandler {
  private view: View2d | View3d;
  private view2d: View2d;
  private view3d: View3d;
  private gridController: GridController;
  private lastGridScale: number;

  constructor(gridController: GridController, view2d: View2d, view3d: View3d) {
    this.gridController = gridController;
    this.lastGridScale = gridController.getGridSize();
    this.view2d = view2d;
    this.view3d = view3d;
    this.view = view2d;
  }

  get sec() { return this.view.sec }
  get x() { return this.view.x }
  get y() { return this.view.y }
  get z() { return this.view.z }

  target() { return this.view.target() }
  targets() { return this.view.targets() }
  snapTargets() { return this.view.snapTargets() }
  dir() { return this.view.dir() }
  drawTools(renderables: Iterable<Renderable>) { this.view.drawTools(renderables) }

  handle(message: Message) {
    if (message instanceof NamedMessage && message.name == 'view_mode') {
      const viewPos = this.view.getViewPosition();
      this.view = this.view == this.view3d ? this.view2d : this.view3d;
      const gridScale = this.gridController.getGridSize();
      this.gridController.setGridSize(this.lastGridScale);
      this.lastGridScale = gridScale;
      this.view.activate(viewPos);
      return;
    }
    if (message instanceof LoadBoard) {
      this.view2d.handle(message);
      this.view3d.handle(message);
      return;
    }
    this.view.handle(message)
  }
}

function createTools() {
  const list = new Deck<Renderable>();
  return {
    consumer: (r: Renderable) => list.push(r),
    clear: () => list.clear(),
    provider: list,
  }
}

const tools = createTools();
const RENDER = new Render(tools.consumer);

const MOUSE = new Mouse(0, 0);
class ViewControllerImpl extends MessageHandlerReflective implements ViewController {
  private updaters: (() => void)[] = [];
  private views: [View, HTMLCanvasElement][] = [];
  public view: View;

  constructor(
    private bus: MessageBus,
    private offscren: OffscreenCanvas,
    private buildgl: BuildGl,
    private board: BoardProvider,
    private boardUtils: BoardUtils,
    private state: State,
    private grid: GridController,
    private art: ArtProvider,
    private renderer2d: BoardRenderer2D,
    private renderer3d: Boardrenderer3D,
  ) { super(); }

  add(canvas: HTMLCanvasElement, type: ViewType): void {
    if (type == ViewType.VIEW_3D) this.createView3d(canvas);
    if (type == ViewType.VIEW_2D) this.createView2d(canvas);
  }

  currentView(): View {
    return null;
  }

  private createInputUpdater(canvas: HTMLCanvasElement, handler: MessageHandler) {
    const queue = new Deck<Key>();
    let mouseMoved = false;
    const mousedown = (e: MouseEvent) => queue.push(new Key(`mouse${e.button}`, true));
    const mousesp = (e: MouseEvent) => queue.push(new Key(`mouse${e.button}`, false));
    const musemove = (e: MouseEvent) => { MOUSE.x = e.offsetX; MOUSE.y = e.offsetY; mouseMoved = true; }
    const wheel = (e: WheelEvent) => {
      const key = e.deltaY > 0 ? "wheelup" : "wheeldown";
      queue.push(new Key(key, true));
      queue.push(new Key(key, false));
    }
    canvas.addEventListener('mousemove', musemove);
    canvas.addEventListener('mouseup', mousesp);
    canvas.addEventListener('mousedown', mousedown);
    canvas.addEventListener('wheel', wheel);

    return () => {
      if (mouseMoved) {
        handler.handle(MOUSE);
        mouseMoved = false;
      }
      forEach(queue, k => handler.handle(k));
      queue.clear();
    }
  }

  private createView3d(canvas: HTMLCanvasElement) {
    const view = new View3d(canvas, this.renderer3d, this.buildgl, this.board, this.boardUtils, this.state, this.grid, this.art);
    const updater = this.createInputUpdater(canvas, view);
    this.updaters.push(updater);
    this.views.push([view, canvas]);
  }

  private createView2d(canvas: HTMLCanvasElement) {
    const view = new View2d(canvas, this.renderer2d, this.grid, this.buildgl, this.board, this.boardUtils, this.art, this.state,);
    const updater = this.createInputUpdater(canvas, view);
    this.updaters.push(updater);
    this.views.push([view, canvas]);
  }

  PreFrame(msg: PreFrame) {
    this.updaters.forEach(u => u());
  }

  // PostFrame(msg: PostFrame) {
  //   tools.clear();
  //   this.bus.handle(RENDER);
  //   this.views.forEach(v => {
  //     v.drawTools(tools.provider);

  //   });
  // }

  Frame(msg: Frame) {
    const gl = this.buildgl.gl;
    this.views.forEach(([v, c]) => {
      const parent = c.parentElement;
      const w = parent.clientWidth;
      const h = parent.clientHeight - 10;
      c.width = w;
      c.height = h;
      this.offscren.width = w;
      this.offscren.height = h;
      gl.viewport(0, 0, w, h);
      v.handle(msg);
      c.getContext('bitmaprenderer')
        .transferFromImageBitmap(this.offscren.transferToImageBitmap());
    });
  }

}