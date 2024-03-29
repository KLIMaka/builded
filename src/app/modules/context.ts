import { SelectorConstructor } from '../../app/modules/artselector';
import { Board } from '../../build/board/structs';
import { INDEXED_IMG_LIB, IndexedImgLibJsConstructor } from '../../utils/imglib';
import { Module, getInstances, instance, lifecycle, plugin } from '../../utils/injector';
import { DefaultProfilerConstructor, PROFILER } from '../../utils/profiler';
import { ART, BOARD, BOARD_UTILS, ENGINE_API, GRID, LIGHTMAPS, REFERENCE_TRACKER, SCHEDULER, STATE, STORAGES } from '../apis/app';
import { BUS, DefaultMessageBusConstructor, MessageHandlerReflective, busDisconnector } from '../apis/handler';
import { DefaultScheduler } from './default/app/scheduler';
import { ENTITY_FACTORY, EntityFactoryConstructor } from '../edit/context';
import { Commit, LoadBoard, namedMessageHandler } from '../edit/messages';
import { ClipboardModule } from '../edit/tools/clipboard';
import { DrawSectorModule } from '../edit/tools/drawsector';
import { DrawWallModule } from '../edit/tools/drawwall';
import { JoinSectorsModule } from '../edit/tools/joinsectors';
import { PushWallModule } from '../edit/tools/pushwall';
import { PICNUM_SELECTOR, SelectionModule } from '../edit/tools/selection';
import { SplitWallModule } from "../edit/tools/splitwall";
import { TOOLS_BUS, ToolsBusConstructor } from '../edit/tools/toolsbus';
import { TransformModule } from '../edit/tools/transform';
import { UtilsModule } from '../edit/tools/utils';
import { DefaultBoardUtilsConstructor } from '../modules/default/board-utils';
import { FramegeneratorModule } from "../modules/default/framegenerator";
import { DefaultLightmapsConstructor } from '../modules/default/lightmap';
import { StatusBarModule } from '../modules/statusbar';
import { TaskManagerModule } from '../modules/taskmanager';
import { BuildArtProviderConstructor, TEXTURES_OVERRIDE } from './buildartprovider';
import { DefaultGridController } from './default/grid';
import { DefaultBoardProviderConstructor } from './default/history';
import { DefaultInputConstructor, INPUT } from './default/input';
import { BuildReferenceTrackerImpl } from './default/reftracker';
import { StateImpl } from './default/state';
import { DefaultAdditionalTextures } from './default/utiltex';
import { RenderablesCacheModule } from './geometry/cache';
import { BUILDERS_FACTORY, DefaultBuildersFactory } from './geometry/common';
import { BUFFER_FACTORY, DefaultBufferFactory } from './gl/buffers';
import { BUILD_GL, BuildGlConstructor } from './gl/buildgl';
import { InfoModule } from './info';
import { SwappableViewModule } from './view/view';

function mapBackupService(module: Module) {
  module.bind(plugin('MapBackupService'), lifecycle(async (injector, lifecycle) => {
    const [storages, bus, board, api] = await getInstances(injector, STORAGES, BUS, BOARD, ENGINE_API)
    const defaultBoard = api.newBoard();
    const store = await storages('session');
    lifecycle(bus.connect(new class extends MessageHandlerReflective { Commit(msg: Commit) { store.set('map_bak', board()) } }), busDisconnector(bus));
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
  module.bind(BUS, DefaultMessageBusConstructor);
  module.bind(TOOLS_BUS, ToolsBusConstructor);
  module.bind(BOARD, DefaultBoardProviderConstructor);
  module.bind(BOARD_UTILS, DefaultBoardUtilsConstructor);
  module.bind(ENTITY_FACTORY, EntityFactoryConstructor);
  module.bind(INDEXED_IMG_LIB, IndexedImgLibJsConstructor);
  module.bind(SCHEDULER, DefaultScheduler);
  module.bind(LIGHTMAPS, DefaultLightmapsConstructor)
  module.bind(PROFILER, DefaultProfilerConstructor);
  module.bind(INPUT, DefaultInputConstructor);

  module.install(SwappableViewModule);
  module.install(JoinSectorsModule);
  module.install(DrawSectorModule);
  module.install(DrawWallModule);
  module.install(PushWallModule);
  module.install(SplitWallModule);
  module.install(RenderablesCacheModule);
  module.install(TransformModule);
  module.install(SelectionModule);
  module.install(ClipboardModule);
  module.install(InfoModule);
  module.install(StatusBarModule);
  module.install(UtilsModule);
  module.install(TaskManagerModule);
  module.install(FramegeneratorModule);

  module.install(newMap);
  module.install(mapBackupService);
}