import { Entity, Hitscan, Target } from "../../../build/hitscan";
import { create, Dependency, getInstances, lifecycle, Module, Plugin } from "../../../utils/injector";
import { GRID, GridController, STATE, View, VIEW } from "../../apis/app";
import { BUS, busDisconnector, Message, MessageHandler } from "../../apis/handler";
import { Renderable } from "../../apis/renderable";
import { LoadBoard, NamedMessage } from "../../edit/messages";
import { View2d, View2dConstructor } from "./view2d";
import { View3d, View3dConstructor } from "./view3d";

export class TargetImpl implements Target {
  public coords_: [number, number, number] = [0, 0, 0];
  public entity_: Entity = null;
  get coords() { return this.coords_ }
  get entity() { return this.entity_ }
}

export interface ViewPosition {
  x: number;
  y: number;
  z: number;
  sec: number;
}

const VIEW_2D = new Dependency<View2d>('View 2d');
const VIEW_3D = new Dependency<View3d>('View 3d');

export function SwappableViewModule(module: Module) {
  module.bind(VIEW_2D, View2dConstructor);
  module.bind(VIEW_3D, View3dConstructor);
  module.bind(VIEW, SwappableViewConstructor);
}

const SwappableViewConstructor: Plugin<View> = lifecycle(async (injector, lifecycle) => {
  const [bus, state] = await getInstances(injector, BUS, STATE);
  const view = await create(injector, SwappableView, GRID, VIEW_2D, VIEW_3D);
  lifecycle(state.register('lookaim', false), async s => state.unregister(s));
  lifecycle(bus.connect(view), busDisconnector(bus));
  return view;
});

export class SwappableView implements View, MessageHandler {
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
  snapTarget() { return this.view.snapTarget() }
  dir() { return this.view.dir() }
  drawTools(renderables: Iterable<Renderable>) { this.view.drawTools(renderables) }
  hitscan(hit: Hitscan): Hitscan { return this.view.hitscan(hit) }
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