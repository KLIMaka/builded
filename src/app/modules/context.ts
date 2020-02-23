import { SelectorConstructor } from '../../app/modules/artselector';
import { Board } from '../../build/structs';
import { Deck, map } from '../../utils/collections';
import { loadString } from '../../utils/getter';
import { Texture } from '../../utils/gl/drawstruct';
import { State as StateGl } from '../../utils/gl/stategl';
import { createTexture } from '../../utils/gl/textures';
import { loadImage } from '../../utils/imgutils';
import { create, Dependency, Injector } from '../../utils/injector';
import { InputState } from '../../utils/input';
import { warning } from '../../utils/logger';
import { cyclic } from '../../utils/mathutils';
import * as PROFILE from '../../utils/profiler';
import { ART, BOARD, BoardManipulator_, BoardProvider, BuildReferenceTracker, REFERENCE_TRACKER, State, STATE, View, VIEW, DEFAULT_BOARD } from '../apis/app';
import { BUS, DefaultMessageBus, Message, MessageBus, MessageHandlerReflective } from '../apis/handler';
import { ReferenceTrackerImpl } from '../apis/referencetracker';
import { consumerProvider, HintRenderable, SortingRenderable, WrapRenderable, LayeredRenderables } from '../apis/renderable';
import { EntityFactoryConstructor, ENTITY_FACTORY } from '../edit/context';
import { BoardInvalidate, Frame, LoadBoard, Mouse, NamedMessage, PostFrame, Render } from '../edit/messages';
import { DrawSectorModule } from '../edit/tools/drawsector';
import { JoinSectorsModule } from '../edit/tools/joinsectors';
import { PushWallModule } from '../edit/tools/pushwall';
import { PicNumSelector_, SelectionModule } from '../edit/tools/selection';
import { SplitWallModule } from '../edit/tools/splitwall';
import { Binder, loadBinds } from '../input/keymap';
import { messageParser } from '../input/messageparser';
import { InfoModule } from '../modules/info';
import { StatusBarModule } from '../modules/statusbar';
import { BuildArtProviderConstructor, GL, UtilityTextures_ } from './buildartprovider';
import { RenderablesCacheModule } from './geometry/cache';
import { BUILDERS_FACTORY, DefaultBuildersFactory } from './geometry/common';
import { BUFFER_FACTORY, DefaultBufferFactory } from './gl/buffers';
import { BuildGlConstructor, BUILD_GL } from './gl/buildgl';
import { SwappableViewConstructor } from './view/view';

class History {
  private history: Deck<Board> = new Deck();

  public push(board: Board) { this.history.push(board) }
  public pop() { if (this.history.length() > 1) this.history.pop() }
  public top() { return this.history.top() }
}

function snapGrid(coord: number, gridSize: number): number {
  return Math.round(coord / gridSize) * gridSize;
}

class StateImpl implements State {
  private state: { [index: string]: any } = {};

  register<T>(name: string, defaultValue: T): void {
    let prevState = this.state[name];
    if (prevState != undefined) throw new Error(`Redefining state ${name}`);
    this.state[name] = defaultValue;
  }

  set<T>(name: string, value: T): void {
    this.get(name);
    this.state[name] = value;
  }

  get<T>(name: string): T {
    let stateValue = this.state[name];
    if (stateValue == undefined) throw new Error(`State ${name} is unregistered`);
    return stateValue;
  }
}

const FRAME = new Frame(0);
const POSTFRAME = new PostFrame();
const MOUSE = new Mouse(0, 0);
const tools = consumerProvider<HintRenderable>();
const RENDER = new Render(tools.consumer);
const INVALIDATE_ALL = new BoardInvalidate(null);

class BuildReferenceTrackerImpl implements BuildReferenceTracker {
  readonly walls = new ReferenceTrackerImpl<number>(-1);
  readonly sectors = new ReferenceTrackerImpl<number>(-1);
  readonly sprites = new ReferenceTrackerImpl<number>(-1);
}

export interface GridController {
  setGridSize(size: number): void;
  getGridSize(): number;
  incGridSize(): void;
  decGridSize(): void;
  snap(x: number): number;
}
export const GRID = new Dependency<GridController>('GridController');

export class GridControllerImpl extends MessageHandlerReflective {
  private gridSizes = [16, 32, 64, 128, 256, 512, 1024];
  private gridSizeIdx = 3;

  public setGridSize(size: number) {
    if (size < this.gridSizes[0]) this.gridSizeIdx = 0;
    else if (size > this.gridSizes[this.gridSizes.length - 1]) this.gridSizeIdx = this.gridSizes.length - 1;
    else {
      for (let i = 0; i < this.gridSizes.length - 2; i++) {
        const i1 = i + 1;
        if (size > this.gridSizes[i1]) continue;
        this.gridSizeIdx = (size - this.gridSizes[i]) < (this.gridSizes[i1] - size) ? i : i1;
        break;
      }
    }
  }

  public getGridSize(): number { return this.gridSizes[this.gridSizeIdx] }
  public incGridSize() { this.gridSizeIdx = cyclic(this.gridSizeIdx + 1, this.gridSizes.length) }
  public decGridSize() { this.gridSizeIdx = cyclic(this.gridSizeIdx - 1, this.gridSizes.length) }
  public snap(x: number) { return snapGrid(x, this.getGridSize()) }

  NamedMessage(msg: NamedMessage) {
    switch (msg.name) {
      case 'grid+': this.incGridSize(); return;
      case 'grid-': this.decGridSize(); return;
    }
  }
}

async function GridControllerConstructor(injector: Injector) {
  const bus = await injector.getInstance(BUS);
  const grid = new GridControllerImpl();
  bus.connect(grid);
  return grid;
}

export const KeymapConfig_ = new Dependency<string>('KeymapConfig');

async function loadTexture(gl: WebGLRenderingContext, name: string, options: any = {}, format = gl.RGBA, bpp = 4) {
  return loadImage(name).then(img => createTexture(img[0], img[1], gl, options, img[2], format, bpp))
}

async function loadUtilityTextures(textures: [number, Promise<Texture>][]) {
  return Promise.all(map(textures, t => t[1])).then(
    async _ => {
      const result: { [index: number]: Texture } = {};
      for (const [id, tex] of textures) result[id] = await tex;
      return result;
    }
  )
}

export async function BoardProviderConstructor(injector: Injector): Promise<BoardProvider> {
  const bus = await injector.getInstance(BUS);
  const cloner = await injector.getInstance(BoardManipulator_);
  const defaultBoard = await injector.getInstance(DEFAULT_BOARD);
  const history = new History();
  let activeBoard: Board = cloner.cloneBoard(defaultBoard);
  history.push(cloner.cloneBoard(defaultBoard));
  bus.connect(new class extends MessageHandlerReflective {
    NamedMessage(msg: NamedMessage) {
      switch (msg.name) {
        case 'undo':
          history.pop();
          activeBoard = cloner.cloneBoard(history.top());
          bus.handle(INVALIDATE_ALL);
          return;
      }
    }

    LoadBoard(msg: LoadBoard) {
      activeBoard = cloner.cloneBoard(msg.board);
      history.push(cloner.cloneBoard(msg.board));
      bus.handle(INVALIDATE_ALL);
    }
  })
  return () => activeBoard;
}

export function ContextModule(injector: Injector) {
  injector.bindInstance(REFERENCE_TRACKER, new BuildReferenceTrackerImpl());
  injector.bindInstance(STATE, new StateImpl());
  injector.bindPromise(KeymapConfig_, loadString('builded_binds.txt'));
  injector.bindPromise(UtilityTextures_, injector.getInstance(GL).then(gl => loadUtilityTextures([
    [-1, loadTexture(gl, 'resources/point1.png', { filter: WebGLRenderingContext.NEAREST, repeat: WebGLRenderingContext.CLAMP_TO_EDGE })],
    [-2, loadTexture(gl, 'resources/img/font.png', { filter: WebGLRenderingContext.NEAREST, repeat: WebGLRenderingContext.CLAMP_TO_EDGE })],
    [-3, loadTexture(gl, 'resources/grid.png', { filter: WebGLRenderingContext.LINEAR_MIPMAP_LINEAR, repeat: WebGLRenderingContext.REPEAT, aniso: true })],
  ])));
  injector.bind(GRID, GridControllerConstructor);
  injector.bind(ART, BuildArtProviderConstructor);
  injector.bind(PicNumSelector_, SelectorConstructor);
  injector.bind(VIEW, SwappableViewConstructor);
  injector.bind(BUILD_GL, BuildGlConstructor);
  injector.bind(BUFFER_FACTORY, DefaultBufferFactory);
  injector.bind(BUILDERS_FACTORY, DefaultBuildersFactory);
  injector.bind(BUS, DefaultMessageBus);
  injector.bind(BOARD, BoardProviderConstructor);
  injector.bind(ENTITY_FACTORY, EntityFactoryConstructor);

  injector.install(SplitWallModule);
  injector.install(JoinSectorsModule);
  injector.install(DrawSectorModule);
  injector.install(PushWallModule);
  injector.install(RenderablesCacheModule);
  injector.install(SelectionModule);
  injector.install(InfoModule);
  injector.install(StatusBarModule);
}

export function MainLoopConstructor(injector: Injector) {
  return create(injector, MainLoop, VIEW, BUS, STATE, KeymapConfig_);
}

export class MainLoop extends MessageHandlerReflective {
  private view: View;
  private binder = new Binder();
  private bus: MessageBus;
  private state: State;

  constructor(view: View, bus: MessageBus, state: State, binds: string) {
    super();
    this.view = view;
    this.bus = bus;
    this.state = state;
    loadBinds(binds, this.binder, messageParser);
    this.bus.connect(this);
  }

  private mouseMove(input: InputState) {
    if (MOUSE.x == input.mouseX && MOUSE.y == input.mouseY) return;
    MOUSE.x = input.mouseX;
    MOUSE.y = input.mouseY;
    this.bus.handle(MOUSE);
  }

  private poolMessages(input: InputState) {
    this.binder.updateState(input, this.state);
    return this.binder.poolEvents(input);
  }

  private drawTools() {
    tools.clear();
    this.message(RENDER);
    this.view.drawTools(tools.provider);
  }

  private message(msg: Message) {
    this.bus.handle(msg);
  }

  frame(input: InputState, dt: number) {
    PROFILE.start();
    this.mouseMove(input);
    FRAME.dt = dt;
    this.message(FRAME);
    for (const message of this.poolMessages(input)) this.message(message);
    this.drawTools();
    PROFILE.endProfile();
    this.message(POSTFRAME);
  }
}