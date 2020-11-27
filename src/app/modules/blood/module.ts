import { cloneBoard, cloneSector, cloneSprite, cloneWall, loadBloodMap, newBoard, newSector, newSprite, newWall, saveBloodMap } from '../../../build/blood/maploader';
import { BloodBoard } from '../../../build/blood/structs';
import { BloodImplementationConstructor } from '../../../build/blood/utils';
import { EngineApi } from '../../../build/board/mutations/api';
import { ArtFile, ArtFiles } from '../../../build/formats/art';
import { RffFile } from '../../../build/formats/rff';
import { createTexture } from '../../../utils/gl/textures';
import { getInstances, Injector, Module } from '../../../utils/injector';
import { Stream } from '../../../utils/stream';
import { BOARD, BuildResources, ENGINE_API, RESOURCES } from '../../apis/app';
import { BUS } from '../../apis/handler';
import { LoadBoard, namedMessageHandler } from '../../edit/messages';
import { Palette, PIC_TAGS, RAW_PAL, RAW_PLUs } from '../artselector';
import { ART_FILES, GL, PARALLAX_TEXTURES } from '../buildartprovider';
import { FileSystem, FS } from '../fs/fs';
import { FS_MANAGER } from '../fs/manager';
import { PALSWAPS, PAL_TEXTURE, PLU_TEXTURE, SHADOWSTEPS } from '../gl/buildgl';
import { MAP_NAMES, showMapSelection } from '../selectmap';
import { Implementation_ } from '../view/boardrenderer3d';
import { showMapNameSelection } from '../../modules/default/mapnamedialog';
import { enumerate, map } from '../../../utils/collections';
import { iter } from '../../../utils/iter';

async function loadArtFiles(injector: Injector): Promise<ArtFiles> {
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
}

async function loadPLUs(injector: Injector) {
  return (await injector.getInstance(RAW_PLUs)).length;
}

async function loadPalTexture(injector: Injector) {
  const [pal, gl] = await Promise.all([injector.getInstance(RAW_PAL), injector.getInstance(GL)]);
  return createTexture(256, 1, gl, { filter: gl.NEAREST }, pal, gl.RGB, 3);
}

async function loarRawPlus(injector: Injector) {
  const res = await injector.getInstance(RESOURCES)
  const palettes = ['NORMAL', 'SATURATE', 'BEAST', 'TOMMY', 'SPIDER3', 'GRAY', 'GRAYISH', 'SPIDER1', 'SPIDER2', 'FLAME', 'COLD', 'P1', 'P2', 'P3', 'P4'];
  const plus = await Promise.all(palettes.map(p => res.get(p + '.PLU')));
  return iter(enumerate(plus)).filter(([p, i]) => p != null).map(([p, i]) => <Palette>{ name: palettes[i], plu: new Uint8Array(p) }).collect();
}

async function loadPluTexture(injector: Injector) {
  const [plus, gl, shadowsteps] = await getInstances(injector, RAW_PLUs, GL, SHADOWSTEPS);
  const tex = new Uint8Array(256 * shadowsteps * plus.length);
  for (const [plu, i] of enumerate(plus)) tex.set(plu.plu, 256 * shadowsteps * i);
  return createTexture(256, shadowsteps * plus.length, gl, { filter: gl.NEAREST }, tex, gl.LUMINANCE)
}

function loadMapImpl(name: string) {
  return async (injector: Injector) => {
    const res = await injector.getInstance(RESOURCES)
    return loadBloodMap(new Stream(await res.get(name), true));
  }
}

function mapLoader(module: Module) {
  module.execute(async injector => {
    const bus = await injector.getInstance(BUS);
    bus.connect(namedMessageHandler('load_map', async () => {
      const mapName = await showMapSelection(injector);
      if (!mapName) return;
      const map = await loadMapImpl(mapName)(injector);
      bus.handle(new LoadBoard(map));
    }));
  });
}

function mapSaver(module: Module) {
  let mapName = 'newboard.map';
  let savedBefore = false;

  module.execute(async injector => {
    const [bus, fsmgr, board] = await getInstances(injector, BUS, FS_MANAGER, BOARD);
    const saveMap = (name: string) => {
      if (name != null && name.length != 0) {
        if (!name.endsWith('.map')) name = name + '.map'
        fsmgr.write(name, saveBloodMap(<BloodBoard>board()))
        mapName = name;
        savedBefore = true;
      }
    }

    bus.connect(namedMessageHandler('save_map', async () => saveMap(savedBefore ? mapName : await showMapNameSelection(injector, mapName))));
    bus.connect(namedMessageHandler('save_map_as', async () => saveMap(await showMapNameSelection(injector, mapName))));
  });
}

async function getMapNames(injector: Injector) {
  const res = await injector.getInstance(RESOURCES);
  return () => res.list().then(list => list.filter(f => f.toLowerCase().endsWith('.map')));
}

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

async function loadPal(injector: Injector) {
  const res = await injector.getInstance(RESOURCES);
  return new Uint8Array(await res.get('BLOOD.PAL'));
}

async function BloodResources(injector: Injector): Promise<BuildResources> {
  const fs = await injector.getInstance(FS);
  const rfffs = await loadRffFs(injector);
  return {
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
}

async function PicTags(injector: Injector) {
  const fs = await injector.getInstance(FS);
  const surface = new Uint8Array(await fs.get('SURFACE.DAT'));
  const tags = ['None', 'Stone', 'Metal', 'Wood', 'Flesh', 'Water', 'Dirt', 'Clay', 'Snow', 'Ice', 'Leaves', 'Cloth', 'Plant', 'Goo', 'Lava'];
  return {
    allTags() { return tags },
    tags(id: number) {
      if (surface.length <= id) return []
      return [tags[surface[id]]];
    }
  }
}

function engineApi(): EngineApi {
  return { cloneBoard, cloneWall, cloneSprite, cloneSector, newWall, newSector, newSprite, newBoard };
}

export function BloodModule(module: Module) {
  module.bindInstance(PARALLAX_TEXTURES, 16);
  module.bindInstance(ENGINE_API, engineApi());
  module.bindInstance(SHADOWSTEPS, 64);
  module.bind(RESOURCES, BloodResources);
  module.bind(ART_FILES, loadArtFiles);
  module.bind(RAW_PAL, loadPal);
  module.bind<Palette[]>(RAW_PLUs, loarRawPlus);
  module.bind(PALSWAPS, loadPLUs);
  module.bind(PAL_TEXTURE, loadPalTexture);
  module.bind(PLU_TEXTURE, loadPluTexture);
  module.bind(Implementation_, BloodImplementationConstructor);
  module.bind(MAP_NAMES, getMapNames);
  module.bind(PIC_TAGS, PicTags);

  module.install(mapLoader);
  module.install(mapSaver);
}