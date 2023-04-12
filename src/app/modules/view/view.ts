import { Input } from "app/input/keymap";
import { vec3 } from "gl-matrix";
import { EMPTY_COLLECTION, filter } from "utils/collections";
import { Comparator, SortedHeap } from "utils/list";
import { EMPTY_TARGET, Entity, Ray, Target } from "../../../build/hitscan";
import { Dependency, Module, Plugin, getInstances, lifecycle, provider } from "../../../utils/injector";
import { ART, ArtProvider, BOARD, BOARD_UTILS, BoardProvider, BoardUtils, EMPLY_SNAP_TARGETS as EMPTY_SNAP_TARGETS, GRID, GridController, STATE, SnapTarget, SnapTargets, SnapType, State, VIEW, View } from "../../apis/app";
import { BUS, Message, MessageBus, MessageHandler, MessageHandlerReflective, busDisconnector } from "../../apis/handler";
import { Renderable } from "../../apis/renderable";
import { LoadBoard, NamedMessage } from "../../edit/messages";
import { OFFSCREEN } from "../buildartprovider";
import { INPUT } from "../default/input";
import { BUILD_GL, BuildGl } from "../gl/buildgl";
import { BoardRenderer2D, Renderer2D } from "./boardrenderer2d";
import { Boardrenderer3D, Renderer3D } from "./boardrenderer3d";
import { ViewCanvas } from "./common";
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

export interface ViewFactory {
  create2d(): ViewCanvas;
  create3d(): ViewCanvas;
}

export const VIEW_FACTORY = new Dependency<ViewFactory>('View Controller');

export function SwappableViewModule(module: Module) {
  module.bind(VIEW_FACTORY, ViewFactoryConstructor);
  module.bind(VIEW, ViewConstructor);
}

// const SwappableViewConstructor: Plugin<View> = lifecycle(async (injector, lifecycle) => {
//   const [bus, state] = await getInstances(injector, BUS, STATE);
//   const view = await create(injector, SwappableView, GRID, VIEW_2D, VIEW_3D);
//   lifecycle(bus.connect(view), busDisconnector(bus));
//   return view;
// });

const ViewFactoryConstructor: Plugin<ViewFactory> = lifecycle(async (injector, lifecycle) => {
  const [bus, offscreen, buildgl, board, boardUtils, state, grid, art, input] = await getInstances(injector, BUS, OFFSCREEN, BUILD_GL, BOARD, BOARD_UTILS, STATE, GRID, ART, INPUT);
  const renderer2d = await Renderer2D(injector);
  const renderer3d = await Renderer3D(injector);
  const ctl = new ViewFactoryImpl(bus, input, offscreen, buildgl, board, boardUtils, state, grid, art, renderer2d, renderer3d);
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
    return def;
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
  const [ctl] = await getInstances(injector, VIEW_FACTORY);
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



class ViewFactoryImpl extends MessageHandlerReflective implements ViewFactory {
  public view: View;

  constructor(
    private bus: MessageBus,
    private input: Input,
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

  private createCanvas() {
    const canvas = document.createElement('canvas');
    canvas.style.height = 'calc(100% - 2px)';
    canvas.style.width = 'calc(100% - 2px)';
    canvas.tabIndex = 1;
    return canvas;
  }
  create3d(): ViewCanvas {
    const canvas = this.createCanvas();
    return new View3d(this.buildgl.gl, this.offscren, canvas, this.renderer3d, this.buildgl, this.board, this.boardUtils, this.state, this.grid, this.art);
  }

  create2d(): ViewCanvas {
    const canvas = this.createCanvas();
    return new View2d(this.buildgl.gl, this.offscren, canvas, this.renderer2d, this.grid, this.buildgl, this.board, this.boardUtils, this.art, this.state);
  }
}