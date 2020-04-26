import { SelectorConstructor } from '../../app/modules/artselector';
import { Board } from '../../build/board/structs';
import { loadString } from '../../utils/getter';
import { IndexedImgLibJsConstructor, INDEXED_IMG_LIB } from '../../utils/imglib';
import { create, Dependency, Injector } from '../../utils/injector';
import { InputState } from '../../utils/input';
import * as PROFILE from '../../utils/profiler';
import { ART, BOARD, DEFAULT_BOARD, GRID, REFERENCE_TRACKER, State, STATE, STORAGES, View, VIEW } from '../apis/app';
import { BUS, DefaultMessageBus, MessageBus, MessageHandlerReflective } from '../apis/handler';
import { consumerProvider, HintRenderable } from '../apis/renderable';
import { EntityFactoryConstructor, ENTITY_FACTORY } from '../edit/context';
import { Frame, LoadBoard, Mouse, namedMessageHandler, PostFrame, Render } from '../edit/messages';
import { DrawSectorModule } from '../edit/tools/drawsector';
import { JoinSectorsModule } from '../edit/tools/joinsectors';
import { PushWallModule } from '../edit/tools/pushwall';
import { PicNumSelector_, SelectionModule } from '../edit/tools/selection';
import { UtilsModule } from '../edit/tools/utils';
import { Binder, loadBinds } from '../input/keymap';
import { messageParser } from '../input/messageparser';
import { InfoModule } from '../modules/info';
import { StatusBarModule } from '../modules/statusbar';
import { BuildArtProviderConstructor, UtilityTextures_ } from './buildartprovider';
import { DefaultGridController } from './default/grid';
import { DefaultBoardProviderConstructor } from './default/history';
import { BuildReferenceTrackerImpl } from './default/reftracker';
import { StateImpl } from './default/state';
import { DefaultAdditionalTextures } from './default/utiltex';
import { RenderablesCacheModule } from './geometry/cache';
import { BUILDERS_FACTORY, DefaultBuildersFactory } from './geometry/common';
import { BUFFER_FACTORY, DefaultBufferFactory } from './gl/buffers';
import { BuildGlConstructor, BUILD_GL } from './gl/buildgl';
import { SwappableViewConstructor } from './view/view';



export const KeymapConfig_ = new Dependency<string>('KeymapConfig');

async function mapBackupService(injector: Injector) {
  const storages = await injector.getInstance(STORAGES);
  const store = await storages('session');
  const bus = await injector.getInstance(BUS);
  const board = await injector.getInstance(BOARD);
  const defaultBoard = await injector.getInstance(DEFAULT_BOARD);
  bus.connect(namedMessageHandler('commit', () => store.set('map_bak', board())));
  bus.connect(namedMessageHandler('new_board', () => {
    bus.handle(new LoadBoard(defaultBoard));
    store.set('map_bak', defaultBoard);
  }));
}

async function loadBakMap(injector: Injector) {
  const storages = await injector.getInstance(STORAGES);
  const store = await storages('session');
  const map = <Board>await store.get('map_bak');
  if (map) {
    const bus = await injector.getInstance(BUS);
    bus.handle(new LoadBoard(map));
  }
}

export function DefaultSetupModule(injector: Injector) {
  injector.bindInstance(REFERENCE_TRACKER, new BuildReferenceTrackerImpl());
  injector.bindInstance(STATE, new StateImpl());
  injector.bindPromise(KeymapConfig_, loadString('builded_binds.txt'));
  injector.bind(UtilityTextures_, DefaultAdditionalTextures);
  injector.bind(GRID, DefaultGridController);
  injector.bind(ART, BuildArtProviderConstructor);
  injector.bind(PicNumSelector_, SelectorConstructor);
  injector.bind(VIEW, SwappableViewConstructor);
  injector.bind(BUILD_GL, BuildGlConstructor);
  injector.bind(BUFFER_FACTORY, DefaultBufferFactory);
  injector.bind(BUILDERS_FACTORY, DefaultBuildersFactory);
  injector.bind(BUS, DefaultMessageBus);
  injector.bind(BOARD, DefaultBoardProviderConstructor);
  injector.bind(ENTITY_FACTORY, EntityFactoryConstructor);
  injector.bind(INDEXED_IMG_LIB, IndexedImgLibJsConstructor);

  injector.install(JoinSectorsModule);
  injector.install(DrawSectorModule);
  injector.install(PushWallModule);
  injector.install(RenderablesCacheModule);
  injector.install(SelectionModule);
  injector.install(InfoModule);
  injector.install(StatusBarModule);
  injector.install(UtilsModule);

  injector.install(mapBackupService);
  injector.install(loadBakMap);
}

export function MainLoopConstructor(injector: Injector) {
  return create(injector, MainLoop, VIEW, BUS, STATE, KeymapConfig_);
}

const FRAME = new Frame(0);
const POSTFRAME = new PostFrame();
const MOUSE = new Mouse(0, 0);
const tools = consumerProvider<HintRenderable>();
const RENDER = new Render(tools.consumer);

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
    this.bus.handle(RENDER);
    this.view.drawTools(tools.provider);
  }

  frame(input: InputState, dt: number) {
    PROFILE.start();
    this.mouseMove(input);
    FRAME.dt = dt;
    this.bus.handle(FRAME);
    for (const message of this.poolMessages(input)) this.bus.handle(message);
    this.drawTools();
    PROFILE.endProfile();
    this.bus.handle(POSTFRAME);
  }
}