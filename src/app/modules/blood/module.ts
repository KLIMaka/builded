import { BloodBoard } from 'build/blood/structs';
import { cloneBoard, cloneSector, cloneSprite, cloneWall, loadBloodMap, newBoard, newSector, newSprite, newWall, saveBloodMap } from '../../../build/blood/maploader';
import { BloodImplementationConstructor } from '../../../build/blood/utils';
import { EngineApi } from '../../../build/board/mutations/api';
import { ArtFile, ArtFiles } from '../../../build/formats/art';
import { RffFile } from '../../../build/formats/rff';
import { enumerate } from '../../../utils/collections';
import { createTexture } from '../../../utils/gl/textures';
import { getInstances, Injector, instance, lifecycle, Module, plugin, provider } from '../../../utils/injector';
import { iter } from '../../../utils/iter';
import { Stream } from '../../../utils/stream';
import { ACTIVITY, BOARD, ENGINE_API, RESOURCES } from '../../apis/app';
import { BUS, busDisconnector } from '../../apis/handler';
import { LoadBoard, namedMessageHandler } from '../../edit/messages';
import { DefaultMapName, MAP_NAME } from '../../modules/default/mapnamedialog';
import { Palette, PicTags, PIC_TAGS, RAW_PAL, RAW_PLUs, TRANS_TABLE } from '../artselector';
import { ART_FILES, GL, PARALLAX_TEXTURES } from '../buildartprovider';
import { FileSystem, FS } from '../fs/fs';
import { MOUNTS } from '../fs/mount';
import { PALSWAPS, PAL_TEXTURE, PLU_TEXTURE, SHADOWSTEPS, TRANS_TEXTURE } from '../gl/buildgl';
import { DefaultMapSelector, MAP_NAMES, MAP_SELECTOR } from '../selectmap';
import { Implementation_ } from '../view/boardrenderer3d';

const artFiles = provider(async (injector: Injector): Promise<ArtFiles> => {
  const res = await injector.getInstance(RESOURCES);
  const arts: ArtFile[] = [];
  for (let a = 0; a < 100; a++) {
    const name = 'TILES0' + ("00" + a).slice(-2) + '.ART';
    const file = await res.get(name);
    if (file) arts.push(new ArtFile(new Stream(file)));
    else break;
  }
  if (arts.length == 0) throw new Error('No ART files was loaded');
  return new ArtFiles(arts);
});

const PLUs = provider(async (injector: Injector) => {
  return (await injector.getInstance(RAW_PLUs)).length;
});

const palTexture = lifecycle(async (injector, lifecycle) => {
  const [pal, gl] = await getInstances(injector, RAW_PAL, GL);
  return lifecycle(createTexture(256, 1, gl, { filter: gl.NEAREST }, pal, gl.RGB, 3), async t => t.destroy(gl));
});

const transTexture = lifecycle(async (injector, lifecycle) => {
  const [table, gl] = await getInstances(injector, TRANS_TABLE, GL);
  return lifecycle(createTexture(256, 256, gl, { filter: gl.NEAREST }, table, gl.LUMINANCE), async t => t.destroy(gl));
});

const rawPlus = provider(async (injector: Injector) => {
  const res = await injector.getInstance(RESOURCES)
  const palettes = ['NORMAL', 'SATURATE', 'BEAST', 'TOMMY', 'SPIDER3', 'GRAY', 'GRAYISH', 'SPIDER1', 'SPIDER2', 'FLAME', 'COLD', 'P1', 'P2', 'P3', 'P4'];
  const plus = await Promise.all(palettes.map(p => res.get(p + '.PLU')));
  return iter(enumerate(plus)).filter(([p, _]) => p != null).map(([p, i]) => <Palette>{ name: palettes[i], plu: new Uint8Array(p) }).collect();
});

const pluTexture = lifecycle(async (injector, lifecycle) => {
  const [plus, gl, shadowsteps] = await getInstances(injector, RAW_PLUs, GL, SHADOWSTEPS);
  const tex = new Uint8Array(256 * shadowsteps * plus.length);
  for (const [plu, i] of enumerate(plus)) tex.set(plu.plu, 256 * shadowsteps * i);
  for (let i = 0; i < shadowsteps * plus.length; i++) tex[256 * i - 1] = 255;
  return lifecycle(createTexture(256, shadowsteps * plus.length, gl, { filter: gl.NEAREST }, tex, gl.LUMINANCE), async t => t.destroy(gl));
});

function loadMapImpl(name: string) {
  return async (injector: Injector) => {
    const res = await injector.getInstance(RESOURCES)
    return loadBloodMap(new Stream(await res.get(name)));
  }
}

function mapLoader(module: Module) {
  module.bind(plugin('MapLoader'), lifecycle(async (injector, lifecycle) => {
    const [bus, mapSelector] = await getInstances(injector, BUS, MAP_SELECTOR);
    lifecycle(bus.connect(namedMessageHandler('load_map', async () => {
      const mapName = await mapSelector();
      if (!mapName) return;
      const map = await loadMapImpl(mapName)(injector);
      bus.handle(new LoadBoard(map));
    })), busDisconnector(bus));
  }));
}

function mapSaver(module: Module) {
  module.bind(plugin('MapSaver'), lifecycle(async (injector, lifecycle) => {
    let mapName = 'newboard.map';
    let savedBefore = false;
    const [mounts, board, bus, mapNameDialog] = await getInstances(injector, MOUNTS, BOARD, BUS, MAP_NAME);
    const saveMap = (name: string) => {
      if (name != null && name.length != 0) {
        if (!name.endsWith('.map')) name = name + '.map'
        mounts[0].write().write(name, saveBloodMap(<BloodBoard>board()))
        mapName = name;
        savedBefore = true;
      }
    }

    lifecycle(bus.connect(namedMessageHandler('save_map', async () => saveMap(savedBefore ? mapName : await mapNameDialog(mapName)))), busDisconnector(bus));
    lifecycle(bus.connect(namedMessageHandler('save_map_as', async () => saveMap(await mapNameDialog(mapName)))), busDisconnector(bus));
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
      write: () => null,
    }
    : {
      get: async name => null,
      list: async () => [],
      write: () => null,
    }
}

const pal = provider(async (injector: Injector) => {
  const res = await injector.getInstance(RESOURCES);
  return new Uint8Array(await res.get('BLOOD.PAL'));
});

const trans = provider(async (injector: Injector) => {
  const res = await injector.getInstance(RESOURCES);
  return new Uint8Array(await res.get('TRANS.TLU'));
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
  const fs = await injector.getInstance(RESOURCES);
  const surfaceDat = await fs.get('SURFACE.DAT');
  if (surfaceDat == null) return <PicTags>{ allTags: () => [], tags: id => [] }
  return loadTags(surfaceDat);
});

function loadTags(surfaceDat: ArrayBuffer) {
  const surface = new Uint8Array(surfaceDat);
  const tags = ['None', 'Stone', 'Metal', 'Wood', 'Flesh', 'Water', 'Dirt', 'Clay', 'Snow', 'Ice', 'Leaves', 'Cloth', 'Plant', 'Goo', 'Lava'];
  return <PicTags>{
    allTags: () => tags,
    tags: id => surface.length <= id ? [] : [tags[surface[id]]]
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
  module.bind(TRANS_TABLE, trans);
  module.bind(RAW_PLUs, rawPlus);
  module.bind(PALSWAPS, PLUs);
  module.bind(PAL_TEXTURE, palTexture);
  module.bind(PLU_TEXTURE, pluTexture);
  module.bind(TRANS_TEXTURE, transTexture);
  module.bind(Implementation_, BloodImplementationConstructor);
  module.bind(MAP_NAMES, mapNames);
  module.bind(MAP_NAME, DefaultMapName);
  module.bind(MAP_SELECTOR, DefaultMapSelector);
  module.bind(PIC_TAGS, picTags);

  module.install(mapLoader);
  module.install(mapSaver);
}