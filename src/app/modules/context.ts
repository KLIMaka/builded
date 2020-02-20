import { cyclic } from '../../utils/mathutils';
import { Dependency, Injector } from '../../utils/injector';
import { Deck, map } from '../../utils/collections';
import { InputState } from '../../utils/input';
import { error, warning } from '../../utils/logger';
import * as PROFILE from '../../utils/profiler';
import { State as StateGl } from '../../utils/gl/stategl';
import { ArtProvider, Bindable, BoardManipulator, BuildContext, BuildReferenceTracker, State, View, BuildReferenceTracker_, State_, ArtProvider_, View_, BoardManipulator_, Board_, BuildContext_ } from '../apis/app';
import { BoardInvalidate, Frame, Mouse, NamedMessage, PostFrame, Render } from '../edit/messages';
import { Message, MessageHandler, MessageHandlerList, MessageHandlerReflective } from '../apis/handler';
import { Binder, loadBinds } from '../input/keymap';
import { messageParser } from '../input/messageparser';
import { ReferenceTrackerImpl } from '../apis/referencetracker';
import { Board } from '../../build/structs';
import { consumerProvider, LayeredRenderable, SortingRenderable, WrapRenderable, BuildersFactory, BUILDERS_FACTORY, DefaultBuildersFactory } from '../apis/renderable';
import { SelectionConstructor, Selection_, PicNumSelector_ } from '../edit/tools/selection';
import { SplitWall } from '../edit/tools/splitwall';
import { JoinSectors } from '../edit/tools/joinsectors';
import { DrawSector } from '../edit/tools/drawsector';
import { PushWall } from '../edit/tools/pushwall';
import { Info } from '../modules/info';
import { RenderablesCache_, RenderablesCacheImpl } from './geometry/cache';
import { Statusbar } from '../modules/statusbar';
import { loadString } from '../../utils/getter';
import { UtilityTextures_, BuildArtProviderConstructor, GL } from './buildartprovider';
import { loadImage } from '../../utils/imgutils';
import { createTexture } from '../../utils/gl/textures';
import { BUILD_GL, BuildGlConstructor } from './gl/buildgl';
import { SwappableViewConstructor } from './view/view';
import { Texture } from '../../utils/gl/drawstruct';
import { SelectorConstructor } from '../../app/modules/artselector'
import { BUFFER_FACTORY, DefaultBufferFactory } from './gl/buffers';

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
    if (prevState != undefined) warning(`Redefining state ${name}`, new Error().stack);
    this.state[name] = defaultValue;
  }

  set<T>(name: string, value: T): void {
    if (this.get(name) == undefined) return;
    this.state[name] = value;
  }

  get<T>(name: string): T {
    let stateValue = this.state[name];
    if (stateValue == undefined) warning(`State ${name} is unregistered`, new Error().stack);
    return stateValue;
  }
}

const tools = consumerProvider<LayeredRenderable>();

const FRAME = new Frame(0);
const POSTFRAME = new PostFrame();
const MOUSE = new Mouse(0, 0);
const RENDER = new Render(tools.consumer);
const INVALIDATE_ALL = new BoardInvalidate(null);

const onTopRenderable = new WrapRenderable(new SortingRenderable(tools.provider),
  (ctx: BuildContext, gl: WebGLRenderingContext, state: StateGl) => {
    gl.disable(WebGLRenderingContext.DEPTH_TEST);
    gl.enable(WebGLRenderingContext.BLEND);
  },
  (ctx: BuildContext, gl: WebGLRenderingContext, state: StateGl) => {
    gl.disable(WebGLRenderingContext.BLEND);
    gl.enable(WebGLRenderingContext.DEPTH_TEST);
  });

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
}
export const GridController_ = new Dependency<GridController>('GridController');

export class GridControllerImpl {
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


export function ContextModule(injector: Injector) {
  injector.bindInstance(GridController_, new GridControllerImpl());
  injector.bindInstance(BuildReferenceTracker_, new BuildReferenceTrackerImpl());
  injector.bindInstance(State_, new StateImpl());
  injector.bind(Selection_, SelectionConstructor);
  injector.bindInstance(RenderablesCache_, new RenderablesCacheImpl());
  injector.bindPromise(KeymapConfig_, loadString('builded_binds.txt'));
  injector.bindPromise(UtilityTextures_, injector.getInstance(GL).then(gl => loadUtilityTextures([
    [-1, loadTexture(gl, 'resources/point1.png', { filter: WebGLRenderingContext.NEAREST, repeat: WebGLRenderingContext.CLAMP_TO_EDGE })],
    [-2, loadTexture(gl, 'resources/img/font.png', { filter: WebGLRenderingContext.NEAREST, repeat: WebGLRenderingContext.CLAMP_TO_EDGE })],
    [-3, loadTexture(gl, 'resources/grid.png', { filter: WebGLRenderingContext.LINEAR_MIPMAP_LINEAR, repeat: WebGLRenderingContext.REPEAT, aniso: true })],
  ])));
  injector.bind(ArtProvider_, BuildArtProviderConstructor);
  injector.bind(PicNumSelector_, SelectorConstructor);
  injector.bind(View_, SwappableViewConstructor);
  injector.bind(BUILD_GL, BuildGlConstructor);
  injector.bind(BUFFER_FACTORY, DefaultBufferFactory);
  injector.bind(BUILDERS_FACTORY, DefaultBuildersFactory);
  injector.bind(BuildContext_, ContextConstructor);
}

export async function ContextConstructor(injector: Injector) {
  return Promise.all([
    injector.getInstance(ArtProvider_),
    injector.getInstance(Board_),
    injector.getInstance(View_),
    injector.getInstance(BoardManipulator_),
    injector.getInstance(GridController_),
    injector.getInstance(RenderablesCache_),
    injector.getInstance(KeymapConfig_),
    injector.getInstance(Selection_),
    injector.getInstance(BUILDERS_FACTORY)
  ]).then(([art, board, view, manipulator, ctrl, cache, binds, selection, builders]) => {
    const ctx = new Context(art, board, view, manipulator, ctrl, builders);
    ctx.loadBinds(binds);
    ctx.addHandler(selection);
    ctx.addHandler(new SplitWall());
    ctx.addHandler(new JoinSectors());
    ctx.addHandler(new DrawSector(builders));
    ctx.addHandler(new PushWall(builders));
    ctx.addHandler(new Info());
    ctx.addHandler(new Statusbar());
    ctx.addHandler(view);
    ctx.addHandler(cache);
    return ctx;
  })
}

export class Context extends MessageHandlerReflective implements BuildContext {
  readonly art: ArtProvider;
  readonly state = new StateImpl();
  readonly view: View;
  readonly refs = new BuildReferenceTrackerImpl();
  readonly buildersFactory: BuildersFactory;

  private binder = new Binder();
  private history: History = new History();
  private activeBoard: Board;
  private boardManipulator: BoardManipulator;
  private handlers = new MessageHandlerList();
  private boundObjects = new Set();
  private gridController: GridController;

  constructor(art: ArtProvider, board: Board, view: View, manipulator: BoardManipulator, gridController: GridController, buildersFactory: BuildersFactory) {
    super();
    this.art = art;
    this.boardManipulator = manipulator;
    this.gridController = gridController;
    this.activeBoard = board;
    this.view = this.bind(view);
    this.buildersFactory = buildersFactory;
    this.commit();

    this.state.register('gridScale', this.gridScale);
  }

  get board() {
    return this.activeBoard;
  }

  get gridScale() {
    return this.gridController.getGridSize();
  }

  private bind<T extends Bindable>(bindable: T): T {
    if (!this.boundObjects.has(bindable)) {
      bindable.bind(this);
      this.boundObjects.add(bindable);
    }
    return bindable;
  }

  private mouseMove(input: InputState) {
    if (MOUSE.x == input.mouseX && MOUSE.y == input.mouseY) return;
    MOUSE.x = input.mouseX;
    MOUSE.y = input.mouseY;
    this.handle(MOUSE, this);
  }

  private poolMessages(input: InputState) {
    this.binder.updateState(input, this.state);
    return this.binder.poolEvents(input);
  }

  private incGridSize() {
    this.gridController.incGridSize();
    this.state.set('gridScale', this.gridScale);
  }

  private decGridSize() {
    this.gridController.decGridSize();
    this.state.set('gridScale', this.gridScale);
  }

  snap(x: number) {
    return snapGrid(x, this.gridScale);
  }

  loadBinds(binds: string) {
    loadBinds(binds, this.binder, messageParser);
  }

  commit() {
    this.history.push(this.boardManipulator.cloneBoard(this.activeBoard));
  }

  private drawTools() {
    tools.clear();
    this.handle(RENDER, this);
    this.view.draw(onTopRenderable);
  }

  private undo() {
    this.history.pop();
    this.activeBoard = this.boardManipulator.cloneBoard(this.history.top());
    this.message(INVALIDATE_ALL);
  }

  addHandler(handler: MessageHandler): void
  addHandler(handler: MessageHandler & Bindable): void {
    if (handler.bind != undefined) this.bind(handler);
    this.handlers.list().push(handler);
  }

  message(msg: Message) {
    this.handle(msg, this);
  }

  handle(msg: Message, ctx: BuildContext) {
    try {
      // info(msg);
      super.handle(msg, ctx);
      this.handlers.handle(msg, ctx);
    } catch (e) {
      error(e, e.stack);
    }
  }

  frame(input: InputState, dt: number) {
    PROFILE.start();
    this.mouseMove(input);
    FRAME.dt = dt;
    this.message(FRAME);
    for (let contextedMessage of this.poolMessages(input)) {
      let message = contextedMessage(this);
      this.message(message);
    }
    this.drawTools();
    PROFILE.endProfile();
    this.message(POSTFRAME);
  }

  NamedMessage(msg: NamedMessage, ctx: BuildContext) {
    switch (msg.name) {
      case 'grid+': this.incGridSize(); return;
      case 'grid-': this.decGridSize(); return;
      case 'undo': this.undo(); return;
    }
  }
}