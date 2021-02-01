import { SelectorConstructor } from '../../app/modules/artselector';
import { Board } from '../../build/board/structs';
import { Deck } from '../../utils/collections';
import { IndexedImgLibJsConstructor, INDEXED_IMG_LIB } from '../../utils/imglib';
import { create, getInstances, Injector, instance, lifecycle, Module, plugin } from '../../utils/injector';
import { ART, BOARD, ENGINE_API, GRID, PORTALS, REFERENCE_TRACKER, SCHEDULER, STATE, STORAGES, View, VIEW } from '../apis/app';
import { BUS, busDisconnector, DefaultMessageBus, MessageBus, MessageHandlerReflective } from '../apis/handler';
import { Renderable } from '../apis/renderable';
import { DefaultScheduler } from '../apis/scheduler';
import { EntityFactoryConstructor, ENTITY_FACTORY } from '../edit/context';
import { Frame, LoadBoard, namedMessageHandler, PostFrame, PreFrame, Render } from '../edit/messages';
import { DrawSectorModule } from '../edit/tools/drawsector';
import { DrawWallModule } from '../edit/tools/drawwall';
import { JoinSectorsModule } from '../edit/tools/joinsectors';
import { PushWallModule } from '../edit/tools/pushwall';
import { PICNUM_SELECTOR, SelectionModule } from '../edit/tools/selection';
import { TransformModule } from '../edit/tools/transform';
import { ClipboardModule } from '../edit/tools/clipboard';
import { ToolsBusConstructor, TOOLS_BUS } from '../edit/tools/toolsbus';
import { UtilsModule } from '../edit/tools/utils';
import { StatusBarModule } from '../modules/statusbar';
import { TaskManagerModule } from '../modules/taskmanager';
import { BuildArtProviderConstructor, TEXTURES_OVERRIDE } from './buildartprovider';
import { DefaultGridController } from './default/grid';
import { DefaultBoardProviderConstructor } from './default/history';
import { BuildReferenceTrackerImpl } from './default/reftracker';
import { StateImpl } from './default/state';
import { DefaultAdditionalTextures } from './default/utiltex';
import { RenderablesCacheModule } from './geometry/cache';
import { BUILDERS_FACTORY, DefaultBuildersFactory } from './geometry/common';
import { BUFFER_FACTORY, DefaultBufferFactory } from './gl/buffers';
import { BuildGlConstructor, BUILD_GL } from './gl/buildgl';
import { InfoModule } from './info';
import { SwappableViewModule } from './view/view';
import { DefaultPortalsConstructor } from '../modules/default/portals';
import { PROFILER, DefaultProfiler, Profiler } from '../../utils/profiler';

function mapBackupService(module: Module) {
  module.bind(plugin('MapBackupService'), lifecycle(async (injector, lifecycle) => {
    const [storages, bus, board, api] = await getInstances(injector, STORAGES, BUS, BOARD, ENGINE_API)
    const defaultBoard = api.newBoard();
    const store = await storages('session');
    lifecycle(bus.connect(namedMessageHandler('commit', () => store.set('map_bak', board()))), busDisconnector(bus));
    lifecycle(bus.connect(namedMessageHandler('new_board', () => {
      bus.handle(new LoadBoard(defaultBoard));
      store.set('map_bak', defaultBoard);
    })), busDisconnector(bus));

    const map = <Board>await store.get('map_bak');
    if (map) {
      const bus = await injector.getInstance(BUS);
      bus.handle(new LoadBoard(map));
    }
  }));
}

function newMap(module: Module) {
  module.bind(plugin('NewMap'), lifecycle(async (injector, lifecycle) => {
    const [bus, api] = await getInstances(injector, BUS, ENGINE_API);
    const defaultBoard = api.newBoard();
    lifecycle(bus.connect(namedMessageHandler('new_board', () => {
      bus.handle(new LoadBoard(defaultBoard));
    })), busDisconnector(bus));
  }));
}


export function DefaultSetupModule(module: Module) {
  module.bind(REFERENCE_TRACKER, instance(new BuildReferenceTrackerImpl()));
  module.bind(STATE, instance(new StateImpl()));
  module.bind(TEXTURES_OVERRIDE, DefaultAdditionalTextures);
  module.bind(GRID, DefaultGridController);
  module.bind(ART, BuildArtProviderConstructor);
  module.bind(PICNUM_SELECTOR, SelectorConstructor);
  module.bind(BUILD_GL, BuildGlConstructor);
  module.bind(BUFFER_FACTORY, DefaultBufferFactory);
  module.bind(BUILDERS_FACTORY, DefaultBuildersFactory);
  module.bind(BUS, instance(DefaultMessageBus()));
  module.bind(TOOLS_BUS, ToolsBusConstructor);
  module.bind(BOARD, DefaultBoardProviderConstructor);
  module.bind(ENTITY_FACTORY, EntityFactoryConstructor);
  module.bind(INDEXED_IMG_LIB, IndexedImgLibJsConstructor);
  module.bind(SCHEDULER, DefaultScheduler);
  module.bind(PORTALS, DefaultPortalsConstructor);
  module.bind(PROFILER, instance(new DefaultProfiler()));

  module.install(SwappableViewModule);
  module.install(JoinSectorsModule);
  module.install(DrawSectorModule);
  module.install(DrawWallModule);
  module.install(PushWallModule);
  module.install(RenderablesCacheModule);
  module.install(TransformModule);
  module.install(SelectionModule);
  module.install(ClipboardModule);
  module.install(InfoModule);
  module.install(StatusBarModule);
  module.install(UtilsModule);
  module.install(TaskManagerModule);

  module.install(newMap);
  // module.install(mapBackupService);
}

export function MainLoopConstructor(injector: Injector) {
  return create(injector, MainLoop, VIEW, BUS, PROFILER);
}

function createTools() {
  const list = new Deck<Renderable>();
  return {
    consumer: (r: Renderable) => list.push(r),
    clear: () => list.clear(),
    provider: list,
  }
}

const FRAME = new Frame(0);
const PREFRAME = new PreFrame();
const POSTFRAME = new PostFrame();
const tools = createTools();
const RENDER = new Render(tools.consumer);

export class MainLoop extends MessageHandlerReflective {
  constructor(
    private view: View,
    private bus: MessageBus,
    private profiler: Profiler
  ) {
    super();
    this.view = view;
    this.bus = bus;
    this.bus.connect(this);
  }

  private drawTools() {
    tools.clear();
    this.bus.handle(RENDER);
    this.view.drawTools(tools.provider);
  }

  frame(dt: number) {
    this.profiler.frameStart();
    const frame = this.profiler.frame().timer('Frame').start();
    this.bus.handle(PREFRAME);
    FRAME.dt = dt;
    this.bus.handle(FRAME);
    this.drawTools();
    frame.stop();
    this.bus.handle(POSTFRAME);
  }
}