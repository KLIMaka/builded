import { SelectorConstructor } from '../../app/modules/artselector';
import { Board } from '../../build/board/structs';
import { Deck } from '../../utils/collections';
import { loadString } from '../../utils/getter';
import { IndexedImgLibJsConstructor, INDEXED_IMG_LIB } from '../../utils/imglib';
import { create, Injector, Module } from '../../utils/injector';
import * as PROFILE from '../../utils/profiler';
import { ART, BOARD, DEFAULT_BOARD, GRID, REFERENCE_TRACKER, SCHEDULER, STATE, STORAGES, View, VIEW } from '../apis/app';
import { BUS, DefaultMessageBus, MessageBus, MessageHandlerReflective } from '../apis/handler';
import { Renderable } from '../apis/renderable';
import { DefaultScheduler } from '../apis/scheduler';
import { EntityFactoryConstructor, ENTITY_FACTORY } from '../edit/context';
import { Frame, LoadBoard, namedMessageHandler, PostFrame, Render } from '../edit/messages';
import { DrawSectorModule } from '../edit/tools/drawsector';
import { DrawWallModule } from '../edit/tools/drawwall';
import { JoinSectorsModule } from '../edit/tools/joinsectors';
import { PushWallModule } from '../edit/tools/pushwall';
import { PICNUM_SELECTOR, SelectionModule } from '../edit/tools/selection';
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
import { KEYBINDS } from './input';
import { SwappableViewModule } from './view/view';

async function mapBackupService(module: Module) {
  module.execute(async injector => {
    const storages = await injector.getInstance(STORAGES);
    const bus = await injector.getInstance(BUS);
    const board = await injector.getInstance(BOARD);
    const defaultBoard = await injector.getInstance(DEFAULT_BOARD);
    const store = await storages('session');
    bus.connect(namedMessageHandler('commit', () => store.set('map_bak', board())));
    bus.connect(namedMessageHandler('new_board', () => {
      bus.handle(new LoadBoard(defaultBoard));
      store.set('map_bak', defaultBoard);
    }));

    const map = <Board>await store.get('map_bak');
    if (map) {
      const bus = await injector.getInstance(BUS);
      bus.handle(new LoadBoard(map));
    }
  });
}

function newMap(module: Module) {
  module.execute(async injector => {
    const bus = await injector.getInstance(BUS);
    const defaultBoard = await injector.getInstance(DEFAULT_BOARD);
    bus.connect(namedMessageHandler('new_board', () => {
      bus.handle(new LoadBoard(defaultBoard));
    }));
  })
}


export function DefaultSetupModule(module: Module) {
  module.bindInstance(REFERENCE_TRACKER, new BuildReferenceTrackerImpl());
  module.bindInstance(STATE, new StateImpl());
  module.bind(KEYBINDS, _ => loadString('builded_binds.txt'));
  module.bind(TEXTURES_OVERRIDE, DefaultAdditionalTextures);
  module.bind(GRID, DefaultGridController);
  module.bind(ART, BuildArtProviderConstructor);
  module.bind(PICNUM_SELECTOR, SelectorConstructor);
  module.bind(BUILD_GL, BuildGlConstructor);
  module.bind(BUFFER_FACTORY, DefaultBufferFactory);
  module.bind(BUILDERS_FACTORY, DefaultBuildersFactory);
  module.bind(BUS, DefaultMessageBus);
  module.bind(BOARD, DefaultBoardProviderConstructor);
  module.bind(ENTITY_FACTORY, EntityFactoryConstructor);
  module.bind(INDEXED_IMG_LIB, IndexedImgLibJsConstructor);
  module.bind(SCHEDULER, DefaultScheduler);

  module.install(SwappableViewModule);
  module.install(JoinSectorsModule);
  module.install(DrawSectorModule);
  module.install(DrawWallModule);
  module.install(PushWallModule);
  module.install(RenderablesCacheModule);
  module.install(SelectionModule);
  module.install(InfoModule);
  module.install(StatusBarModule);
  module.install(UtilsModule);
  module.install(TaskManagerModule);

  module.install(newMap);
  // module.install(mapBackupService);
}

export function MainLoopConstructor(injector: Injector) {
  return create(injector, MainLoop, VIEW, BUS);
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
const POSTFRAME = new PostFrame();
const tools = createTools();
const RENDER = new Render(tools.consumer);

export class MainLoop extends MessageHandlerReflective {
  constructor(
    private view: View,
    private bus: MessageBus,
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
    PROFILE.start();
    FRAME.dt = dt;
    this.bus.handle(FRAME);
    this.drawTools();
    PROFILE.endProfile();
    this.bus.handle(POSTFRAME);
  }
}