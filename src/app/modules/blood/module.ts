import { cloneBoard, cloneSector, cloneSprite, cloneWall, loadBloodMap, newBoard, newSector, newSprite, newWall, saveBloodMap } from '../../../build/blood/maploader';
import { BloodBoard } from '../../../build/blood/structs';
import { BloodImplementationConstructor } from '../../../build/blood/utils';
import { EngineApi } from '../../../build/board/mutations/api';
import { ArtFile, ArtFiles } from '../../../build/formats/art';
import { RffFile } from '../../../build/formats/rff';
import { enumerate } from '../../../utils/collections';
import { createTexture } from '../../../utils/gl/textures';
import { getInstances, Injector, instance, Module, plugin, provider } from '../../../utils/injector';
import { iter } from '../../../utils/iter';
import { Stream } from '../../../utils/stream';
import { BOARD, ENGINE_API, RESOURCES } from '../../apis/app';
import { BUS, BusPlugin } from '../../apis/handler';
import { LoadBoard, namedMessageHandler } from '../../edit/messages';
import { showMapNameSelection } from '../../modules/default/mapnamedialog';
import { Palette, PicTags, PIC_TAGS, RAW_PAL, RAW_PLUs } from '../artselector';
import { ART_FILES, GL, PARALLAX_TEXTURES } from '../buildartprovider';
import { FileSystem, FS } from '../fs/fs';
import { FS_MANAGER } from '../fs/manager';
import { PALSWAPS, PAL_TEXTURE, PLU_TEXTURE, SHADOWSTEPS } from '../gl/buildgl';
import { MAP_NAMES, showMapSelection } from '../selectmap';
import { Implementation_ } from '../view/boardrenderer3d';

const artFiles = provider(async (injector: Injector): Promise<ArtFiles> => {
  const res = await injector.getInstance(RESOURCES);
  const arts: ArtFile[] = [];
  for (let a = 0; a < 100; a++) {
    const name = 'TILES0' + ("00" + a).slice(-2) + '.ART';
    const file = await res.get(name);
    if (file) arts.push(new ArtFile(new Stream(file, true)));
    else break;
  }
  if (arts.length == 0) throw new Error('No ART files was loaded');
  return new ArtFiles(arts);
});

const PLUs = provider(async (injector: Injector) => {
  return (await injector.getInstance(RAW_PLUs)).length;
});

const palTexture = provider(async (injector: Injector) => {
  const [pal, gl] = await getInstances(injector, RAW_PAL, GL);
  return createTexture(256, 1, gl, { filter: gl.NEAREST }, pal, gl.RGB, 3);
});

const rawPlus = provider(async (injector: Injector) => {
  const res = await injector.getInstance(RESOURCES)
  const palettes = ['NORMAL', 'SATURATE', 'BEAST', 'TOMMY', 'SPIDER3', 'GRAY', 'GRAYISH', 'SPIDER1', 'SPIDER2', 'FLAME', 'COLD', 'P1', 'P2', 'P3', 'P4'];
  const plus = await Promise.all(palettes.map(p => res.get(p + '.PLU')));
  return iter(enumerate(plus)).filter(([p, i]) => p != null).map(([p, i]) => <Palette>{ name: palettes[i], plu: new Uint8Array(p) }).collect();
});

const pluTexture = provider(async (injector: Injector) => {
  const [plus, gl, shadowsteps] = await getInstances(injector, RAW_PLUs, GL, SHADOWSTEPS);
  const tex = new Uint8Array(256 * shadowsteps * plus.length);
  for (const [plu, i] of enumerate(plus)) tex.set(plu.plu, 256 * shadowsteps * i);
  return createTexture(256, shadowsteps * plus.length, gl, { filter: gl.NEAREST }, tex, gl.LUMINANCE)
});

function loadMapImpl(name: string) {
  return async (injector: Injector) => {
    const res = await injector.getInstance(RESOURCES)
    return loadBloodMap(new Stream(await res.get(name), true));
  }
}

function mapLoader(module: Module) {
  module.bind(plugin('MapLoader'), new BusPlugin(async (injector, connect) => {
    const bus = await injector.getInstance(BUS);
    connect(namedMessageHandler('load_map', async () => {
      const mapName = await showMapSelection(injector);
      if (!mapName) return;
      const map = await loadMapImpl(mapName)(injector);
      bus.handle(new LoadBoard(map));
    }));
  }));
}

function mapSaver(module: Module) {
  let mapName = 'newboard.map';
  let savedBefore = false;

  module.bind(plugin('MapSaver'), new BusPlugin(async (injector, connect) => {
    const [fsmgr, board] = await getInstances(injector, FS_MANAGER, BOARD);
    const saveMap = (name: string) => {
      if (name != null && name.length != 0) {
        if (!name.endsWith('.map')) name = name + '.map'
        fsmgr.write(name, saveBloodMap(<BloodBoard>board()))
        mapName = name;
        savedBefore = true;
      }
    }

    connect(namedMessageHandler('save_map', async () => saveMap(savedBefore ? mapName : await showMapNameSelection(injector, mapName))));
    connect(namedMessageHandler('save_map_as', async () => saveMap(await showMapNameSelection(injector, mapName))));
  }));
}

const mapNames = provider(async (injector: Injector) => {
  const res = await injector.getInstance(RESOURCES);
  return () => res.list().then(list => list.filter(f => f.toLowerCase().endsWith('.map')));
});

async function loadRffFile(injector: Injector) {
  const fs = await injector.getInstance(FS);
  const rffFile = await fs.get('BLOOD.RFF');
  if (rffFile) return new RffFile(rffFile);
  return null;
}

async function loadRffFs(injector: Injector): Promise<FileSystem> {
  const rff = await loadRffFile(injector)
  return rff
    ? {
      get: async name => { const file = rff.get(name); return file ? file.buffer : null },
      list: async () => rff.fat.map(r => r.filename),
    }
    : {
      get: async name => null,
      list: async () => []
    }
}

const pal = provider(async (injector: Injector) => {
  const res = await injector.getInstance(RESOURCES);
  return new Uint8Array(await res.get('BLOOD.PAL'));
});

const BloodResources = provider(async (injector: Injector) => {
  const fs = await injector.getInstance(FS);
  const rfffs = await loadRffFs(injector);
  return <FileSystem>{
    get: async name => {
      const file = await fs.get(name);
      if (file != null) return file;
      return rfffs.get(name);
    },
    list: async () => {
      const files = new Set<string>(await rfffs.list());
      (await fs.list()).forEach(f => files.add(f));
      return [...files];
    }
  }
});

const picTags = provider(async (injector: Injector) => {
  const fs = await injector.getInstance(FS);
  const surfaceDat = await fs.get('SURFACE.DAT');
  if (surfaceDat == null) return <PicTags>{ allTags: () => [], tags: id => [] }
  return loadTags(surfaceDat);
});

function loadTags(surfaceDat: ArrayBuffer) {
  const surface = new Uint8Array(surfaceDat);
  const tags = ['None', 'Stone', 'Metal', 'Wood', 'Flesh', 'Water', 'Dirt', 'Clay', 'Snow', 'Ice', 'Leaves', 'Cloth', 'Plant', 'Goo', 'Lava'];
  return <PicTags>{
    allTags: () => tags,
    tags: id => {
      if (surface.length <= id)
        return [];
      return [tags[surface[id]]];
    }
  };
}

function engineApi(): EngineApi {
  return { cloneBoard, cloneWall, cloneSprite, cloneSector, newWall, newSector, newSprite, newBoard };
}

export function BloodModule(module: Module) {
  module.bind(PARALLAX_TEXTURES, instance(16));
  module.bind(ENGINE_API, instance(engineApi()));
  module.bind(SHADOWSTEPS, instance(64));
  module.bind(RESOURCES, BloodResources);
  module.bind(ART_FILES, artFiles);
  module.bind(RAW_PAL, pal);
  module.bind(RAW_PLUs, rawPlus);
  module.bind(PALSWAPS, PLUs);
  module.bind(PAL_TEXTURE, palTexture);
  module.bind(PLU_TEXTURE, pluTexture);
  module.bind(Implementation_, BloodImplementationConstructor);
  module.bind(MAP_NAMES, mapNames);
  module.bind(PIC_TAGS, picTags);

  module.install(mapLoader);
  module.install(mapSaver);
}