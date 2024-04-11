import { Source, Value, reference, transformed, tuple, value } from "@utils/callbacks";
import { EMPTY_COLLECTION, getOrCreate, range } from "@utils/collections";
import { iter } from "@utils/iter";
import { Stream } from "@utils/stream";
import { Function } from "@utils/types";
import { ArtProvider, EngineContext, Palette, PicTags } from "app/apis/engine";
import { FileSystem } from "app/apis/fs";
import { BloodBoard } from "build/blood/structs";
import { EngineApi } from "build/board/mutations/api";
import { ArtFile, ArtInfo, ArtInfoProvider, EMPTY_INFO } from "build/formats/art";
import { RffFile } from "build/formats/rff";
import Optional from "optional-js";
import { cloneBoard, cloneSector, cloneSprite, cloneWall, newBoard, newSector, newSprite, newWall } from '../../../build/blood/maploader';
import { watchFile } from "../default/app/fs";


function engineApi(): EngineApi<BloodBoard> {
  return { cloneBoard, cloneWall, cloneSprite, cloneSector, newWall, newSector, newSprite, newBoard };
}

type FileProvider = Function<string, Optional<ArrayBuffer>>;
async function getBloodRff(fs: FileSystem): Promise<Source<FileProvider>> {
  const emptyFs: FileProvider = _ => Optional.empty();
  const load = (data: Optional<ArrayBuffer>) => data
    .map(d => new RffFile(d))
    .map<FileProvider>(rff => name => Optional.ofNullable(<ArrayBuffer>rff.get(name)?.buffer))
    .orElse(emptyFs);
  return transformed(await watchFile('BLOOD.RFF', fs), load);
}

async function openFile(name: string, fs: FileSystem, rff: Source<FileProvider>): Promise<Source<Optional<ArrayBuffer>>> {
  const fileFromRff = transformed(rff, rff => rff(name));
  return transformed(tuple(await watchFile(name, fs), fileFromRff), ([file, rff]) => file.or(() => rff));
}

function resources(fs: FileSystem, rff: Source<FileProvider>): Function<string, Promise<Source<Optional<ArrayBuffer>>>> {
  return fn => openFile(fn, fs, rff);
}

async function loadPal(file: Source<Optional<ArrayBuffer>>): Promise<Source<Uint8Array>> {
  return transformed(file, f => f
    .map(ab => new Uint8Array(ab))
    .orElseThrow(() => new Error('BLOOD.PAL is missing')));
}

async function loadTrans(file: Source<Optional<ArrayBuffer>>): Promise<Source<Uint8Array>> {
  return transformed(file, f => f
    .map(ab => new Uint8Array(ab))
    .orElseThrow(() => new Error('TRANS.PLU is missing')));
}

function genDefaultPlu(): Uint8Array {
  const plu = new Uint8Array(256 * 64);
  for (let s = 0; s < 64; s++) {
    for (let i = 0; i < 256; i++) plu[s * 256 + i] = i;
  }
  return plu;
}

async function loadPlus(fs: FileSystem, rff: Source<FileProvider>): Promise<Source<Map<number, Palette>>> {
  const defaultPlu = genDefaultPlu();
  const palettes = ['NORMAL', 'SATURATE', 'BEAST', 'TOMMY', 'SPIDER3', 'GRAY', 'GRAYISH', 'SPIDER1', 'SPIDER2', 'FLAME', 'COLD', 'P1', 'P2', 'P3', 'P4'];
  const loadPals = await Promise.all(palettes.map(p => openFile(`${p}.PLU`, fs, rff)));
  const plus = iter(loadPals).enumerate().toMap(([_, i]) => i, ([p, _]) => p);
  return transformed(tuple(...plus.values()), p => {
    return iter(p)
      .enumerate()
      .toMap(([_, i]) => i, ([p, i]) => <Palette>{ name: palettes[i], plu: p.map(ab => new Uint8Array(ab)).orElse(defaultPlu) });
  });
}

async function loadPicTags(fs: FileSystem): Promise<Source<PicTags>> {
  return transformed(await watchFile('SURFACE.DAT', fs), s => s
    .map(f => loadTags(f))
    .orElse({ allTags: () => EMPTY_COLLECTION, tags: _ => EMPTY_COLLECTION })
  );
}

function loadTags(surfaceDat: ArrayBuffer): PicTags {
  const surface = new Uint8Array(surfaceDat);
  const tags = ['None', 'Stone', 'Metal', 'Wood', 'Flesh', 'Water', 'Dirt', 'Clay', 'Snow', 'Ice', 'Leaves', 'Cloth', 'Plant', 'Goo', 'Lava'];
  return { allTags: () => tags, tags: id => surface.length <= id ? EMPTY_COLLECTION : [tags[surface[id]]] };
}

function loadArtFile(name: string, file: ArrayBuffer, cache: Map<number, Value<Optional<ArtInfo>>>, filesLoaded: Map<string, [number, number]>): void {
  const art = new ArtFile(new Stream(file));
  iter(range(art.getStart(), art.getEnd()))
    .forEach(i => getOrCreate(cache, i, _ => value(Optional.empty())).set(Optional.ofNullable(art.getInfo(i - art.getStart()))));
  filesLoaded.set(name, [art.getStart(), art.getEnd()]);
}

async function loadArts(fs: FileSystem, cache: Map<number, Value<Optional<ArtInfo>>>, filesLoaded: Map<string, [number, number]>): Promise<ArtProvider> {
  for (const name of (await fs.list()).filter(name => name.match(/TILES\d{3}\.ART/i))) {
    const file = (await fs.get(name)).get();
    loadArtFile(name, file, cache, filesLoaded);
  }
  return picnum => getOrCreate(cache, picnum, _ => value(Optional.empty()));
}

async function loadArt(fs: FileSystem): Promise<ArtProvider> {
  const cache = new Map<number, Value<Optional<ArtInfo>>>();
  const filesLoaded = new Map<string, [number, number]>();
  const arts = await loadArts(fs, cache, filesLoaded);
  fs.addHandler(async (name, deleted) => {
    if (name.match(/TILES\d{3}.ART/)) {
      if (deleted) {
        const [start, end] = filesLoaded.get(name);
        iter(range(start, end)).forEach(i => cache.get(i).set(Optional.empty()));
      } else {
        loadArtFile(name, (await fs.get(name)).get(), cache, filesLoaded);
      }
    }
  })
  return arts;
}

export async function createEngineContext(fs: FileSystem): Promise<EngineContext<BloodBoard>> {
  const api = engineApi();
  const name = "Blood";
  const bloodRff = await getBloodRff(fs);
  const files = resources(fs, bloodRff);
  const pal = loadPal(await files('BLOOD.PAL'));
  const trans = loadTrans(await files('TRANS.TLU'));
  const picTags = loadPicTags(fs);
  const plus = loadPlus(fs, bloodRff);
  const art = loadArt(fs);

  return {
    name,
    api,
    pal,
    trans,
    picTags,
    plus,
    art,
  }
}