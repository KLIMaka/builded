import { ArtInfoExtended, NamedArtFile, Palette } from "app/apis/engine";
import { FileSystem } from "app/apis/fs";
import { AnimationType, readArtFile } from "build/formats/art";
import Optional from "optional-js";
import { Source, Value, ValuesContainer } from "ts-utils/callbacks";
import { rect } from "ts-utils/collections";
import { palColorFinder } from "ts-utils/color";
import { loadImageFromBuffer } from "ts-utils/imgutils";
import { iter } from "ts-utils/iter";
import { asyncMapOptional, asyncOptional, field } from "ts-utils/objects";
import { gen, NOOP_TASK_HANDLE } from "ts-utils/scheduler";
import { first, Function, nil, notUndefined, pair, second } from "ts-utils/types";
import { begin, tuple } from "ts-utils/work";
import { EMPTY, watchFile } from "../fs/fs";

export async function packegeFs(values: ValuesContainer, fs: Source<FileSystem>, name: string, factory: Function<ArrayBuffer, Promise<FileSystem>>): Promise<Source<FileSystem>> {
  return values.transformedAsync(`packegeFs-${name}`, await watchFile(values, name, fs), async buff => asyncMapOptional(buff, async b => factory(b)).then(o => o.orElse(EMPTY)));
}

export async function openFile(values: ValuesContainer, name: string, fs: Source<FileSystem>): Promise<Source<ArrayBuffer>> {
  return values.transformedAsync(`file ${name}`, fs, fs => fs.read(name).then(opt => opt.orElseThrow(() => new Error(`${name} is missing`))));
}

export async function openFileOptional(values: ValuesContainer, name: string, fs: Source<FileSystem>): Promise<Source<Optional<ArrayBuffer>>> {
  return values.transformedAsync(`optionalFile ${name}`, fs, fs => fs.read(name));
}

export async function loadRaw(name: string, values: ValuesContainer, src: Source<ArrayBuffer>): Promise<Source<Uint8Array>> {
  return values.transformed(name, src, buff => new Uint8Array(buff))
}

export const loadArtWork = (function () {
  const TILES_REGEXP = /TILES\d{3}.ART/i;
  const subscriber = (fs: FileSystem, files: Value<NamedArtFile[]>) => {
    return fs.subscribe(async (fn, deleted) => {
      if (!fn.match(TILES_REGEXP)) return;
      const name = fn.toUpperCase();
      if (deleted) {
        files.mod(fs => fs.filter(f => f.name !== name))
      } else {
        const data = (await fs.read(name)).get();
        const art = readArtFile(data);
        files.modImmer(fs => {
          const file: NamedArtFile = { name, art };
          const idx = fs.findIndex(f => f.name === name);
          if (idx === -1) fs.push(file)
          else fs[idx] = file;
        });
      }
    });
  }

  const loadArtsWork = begin()
    .input<FileSystem>()
    .thenPass('Load List', fs => fs.list())
    .thenWork((handle, fs, files) => begin()
      .forkItems(files.filter(f => f.name.match(TILES_REGEXP) !== null),
        f => `Loading ${f.name}`,
        f => fs.read(f.name).then<NamedArtFile>(data => ({ name: f.name.toUpperCase(), art: readArtFile(data.get()) }))
      ).finish()(handle)
    ).finishUntuple();

  let loadHandle = NOOP_TASK_HANDLE;
  async function loadArts(fs: FileSystem): Promise<NamedArtFile[]> {
    return await loadArtsWork(loadHandle, fs);
  }

  return begin()
    .multiInput<[ValuesContainer, Source<FileSystem>]>()
    .thenWork(tuple(async (handle, values, res) => {
      loadHandle = handle;
      const result = await values.transformedAsync('art', res, loadArts, nil(), subscriber);
      loadHandle = NOOP_TASK_HANDLE;
      return result;
    })).finishUntuple();
})()

export function loadArtMap(values: ValuesContainer, arts: Source<NamedArtFile[]>) {
  return values.transformed('artMap', arts, artFiles =>
    iter(artFiles)
      .map(file => iter(file.art.arts)
        .enumerate()
        .map(([info, i]) => pair(file.art.header.start + i, { ...info, artFile: file.name })))
      .flatten()
      .toMap(first, second)
  );
}

export function loadMaxPluId(values: ValuesContainer, plus: Source<Palette[]>) {
  return values.transformed('maxPluId', plus, plus => iter(plus).map(field('id')).reduce(Math.max, 0));
}

export function loadToArtImg(pal: Uint8Array) {
  const finder = palColorFinder(pal);
  return (w: number, h: number, img: Uint8Array, alphacut: number) => {
    const dst = new Uint8Array(w * h);
    for (const [xc, yc] of rect(w, h)) {
      const idx = yc * w + xc;
      if ((img[idx * 4 + 3] / 255) <= alphacut) {
        dst[xc * h + yc] = 255;
      } else {
        const r_ = img[idx * 4];
        const g_ = img[idx * 4 + 1];
        const b_ = img[idx * 4 + 2];
        dst[xc * h + yc] = finder(r_, g_, b_);
      }
    }
    return dst;
  }
}

export type AddonImageDef = Partial<Readonly<{
  file: string,
  alpacut: number,
  xoff: number,
  yoff: number
}>>;

export function loadPicAddonsWork(fs: FileSystem, pal: Uint8Array, files: AddonImageDef[]) {
  const empty = new Uint8Array();
  const toArtImg = loadToArtImg(pal);
  return begin()
    .forkItems(files,
      f => `Loading ${f.file}`,
      f => fs.read(f.file ?? '').then(async o => pair(f, await asyncOptional(o.map(loadImageFromBuffer)))))
    .thenWork(async (handle, tuples) => {
      const tasks = iter(tuples)
        .map(([f, o]) => (): ArtInfoExtended => {
          const [w, h, srcImg] = o.orElse([0, 0, empty]);
          const xoff = f.xoff ?? 0;
          const yoff = f.yoff ?? 0;
          const img = toArtImg(w, h, srcImg, f.alpacut ?? 0.32);
          const attrs = { xoff, yoff, type: 0, speed: 0, frames: 0, animType: AnimationType.NO_ANIMATION };
          return { w, h, img, artFile: notUndefined(f.file), attrs }
        }).collect();
      return [await handle.waitMaybe(gen(tasks, (v, i, total) => `Palettizing ${v.w}x${v.h} (${i}/${total})`), 'Palettizing')];
    }).finish()
}

export type AddonArtMap = Readonly<{ map: Source<Map<number, ArtInfoExtended>>, offset: Source<number> }>;

function addArts(values: ValuesContainer, artMap: Source<Map<number, ArtInfoExtended>>, addons: ArtInfoExtended[]): AddonArtMap {
  const offset = values.transformed('add-art-ofset', artMap, map => {
    const maxPicnum = map.keys().reduce(Math.max);
    return maxPicnum + 1;
  });

  const map = values.transformedTuple('add-art', [artMap, offset], ([map, offset]) => {
    const newMap = new Map(map);
    iter(addons)
      .enumerate()
      .forEach(([info, i]) => newMap.set(offset + i, info));
    return newMap;
  });

  return { map, offset };
}

const EDITOR_ADDONS: AddonImageDef[] = [
  { file: 'resources/point1.png' },
  { file: 'resources/img/font.png' }
]
export function loadEditorPicAddons(values: ValuesContainer, artMap: Source<Map<number, ArtInfoExtended>>, fs: Source<FileSystem>, pal: Source<Uint8Array>) {
  return begin()
    .thenWork(async handle => loadPicAddonsWork(fs.get(), pal.get(), EDITOR_ADDONS)(handle))
    .then('Adding Pic Addons', async infos => addArts(values, artMap, infos))
    .finish();
}
