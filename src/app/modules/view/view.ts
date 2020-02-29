import { DEFAULT_REPEAT_RATE, nextwall } from "../../../build/boardutils";
import { Entity, Target } from "../../../build/hitscan";
import { Board } from "../../../build/structs";
import { create, Dependency, Injector } from "../../../utils/injector";
import { int, len2d, tuple2 } from "../../../utils/mathutils";
import { STATE, State, View } from "../../apis/app";
import { BUS, Message, MessageHandler } from "../../apis/handler";
import { HintRenderable, RenderableProvider } from "../../apis/renderable";
import { LoadBoard, NamedMessage } from "../../edit/messages";
import { GRID, GridController } from "../context";
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

const snapResult: [number, number] = [0, 0];
export function snapWall(w: number, x: number, y: number, board: Board, grid: GridController) {
  const wall = board.walls[w];
  const w1 = nextwall(board, w);
  const wall1 = board.walls[w1];
  const dx = wall1.x - wall.x;
  const dy = wall1.y - wall.y;
  const repeat = DEFAULT_REPEAT_RATE * wall.xrepeat;
  const dxt = x - wall.x;
  const dyt = y - wall.y;
  const dt = len2d(dxt, dyt) / len2d(dx, dy);
  const t = grid.snap(dt * repeat) / repeat;
  const xs = int(wall.x + (t * dx));
  const ys = int(wall.y + (t * dy));
  return tuple2(snapResult, xs, ys);
}

const VIEW_2D = new Dependency<View2d>('View 2d');
const VIEW_3D = new Dependency<View3d>('View 3d');

export async function SwappableViewConstructor(injector: Injector) {
  injector.bind(VIEW_2D, View2dConstructor);
  injector.bind(VIEW_3D, View3dConstructor);
  const bus = await injector.getInstance(BUS);
  const view = await create(injector, SwappableView, GRID, VIEW_2D, VIEW_3D, STATE);
  bus.connect(view);
  return view;
}

export class SwappableView implements View, MessageHandler {
  private view: View2d | View3d;
  private view2d: View2d;
  private view3d: View3d;
  private gridController: GridController;
  private lastGridScale: number;

  constructor(gridController: GridController, view2d: View2d, view3d: View3d, state: State) {
    this.gridController = gridController;
    this.lastGridScale = gridController.getGridSize();
    this.view2d = view2d;
    this.view3d = view3d;
    this.view = view3d;
    state.register('lookaim', false);
  }

  get sec() { return this.view.sec }
  get x() { return this.view.x }
  get y() { return this.view.y }
  get z() { return this.view.z }

  target() { return this.view.target() }
  snapTarget() { return this.view.snapTarget() }
  dir() { return this.view.dir() }
  drawTools(provider: RenderableProvider<HintRenderable>) { this.view.drawTools(provider) }

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