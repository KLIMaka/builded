import { ArtInfoExtended, NamedArtFile, Palette } from "app/apis/engine";
import { FileSystem } from "app/apis/fs";
import { AnimationType, readArtFile } from "build/formats/art";
import Optional from "optional-js";
import { Source, Value, ValuesContainer } from "ts-utils/callbacks";
import { rect } from "ts-utils/collections";
import { palColorFinder } from "ts-utils/color";
import { cookbook, cookbookInput } from "ts-utils/cookbook";
import { loadImageFromBuffer } from "ts-utils/imgutils";
import { iter } from "ts-utils/iter";
import { asyncMapOptional, asyncOptional, field } from "ts-utils/objects";
import { gen, Task } from "ts-utils/scheduler";
import { BiFn, first, nil, notUndefined, pair, second, typeToken } from "ts-utils/types";
import { EMPTY, watchFileNamed } from "../fs/fs";
import { taskHandleContext } from "../scheduler/utils";
import { EngineDefs } from "./def-utils";

export async function packegeFs(values: ValuesContainer, fs: Source<FileSystem>, name: Source<string>, factory: BiFn<ArrayBuffer, string, Promise<FileSystem>>): Promise<Source<FileSystem>> {
  return values.transformedAsyncTuple(`packegeFs-${name.name}`, [await watchFileNamed(values, name, fs), name],
    async ([buff, name]) => asyncMapOptional(buff, async b => factory(b, name)).then(o => o.orElse(EMPTY)));
}

export async function openFile(values: ValuesContainer, name: string, fs: Source<FileSystem>): Promise<Source<ArrayBuffer>> {
  return values.transformedAsync(`file ${name}`, fs, fs => fs.read(name).then(opt => opt.orElseThrow(() => new Error(`${name} is missing`))));
}

export async function openFileOptional(values: ValuesContainer, name: string, fs: Source<FileSystem>): Promise<Source<Optional<ArrayBuffer>>> {
  return values.transformedAsync(`optionalFile ${name}`, fs, fs => fs.read(name));
}

export async function openFileOptionalNamed(values: ValuesContainer, name: Source<string>, fs: Source<FileSystem>): Promise<Source<Optional<ArrayBuffer>>> {
  return values.transformedAsyncTuple(`optionalFile ${name}`, [fs, name], ([fs, name]) => fs.read(name));
}

export async function loadRaw(name: string, values: ValuesContainer, src: Source<ArrayBuffer>): Promise<Source<Uint8Array>> {
  return values.transformed(name, src, buff => new Uint8Array(buff))
}

export const loadArtTask = (() => {
  const TILES_REGEXP = /TILES\d{3}.ART/i;
  const subscriber = (fs: FileSystem, files: Value<NamedArtFile[]>) => {
    return fs.subscribe(async (fn, deleted) => {
      if (!fn.match(TILES_REGEXP)) return;
      const name = fn.toUpperCase();
      if (deleted) {
        files.mod(fs => fs.filter(f => f.name !== name))
      } else {
        const info = (await fs.info(name)).get();
        const data = (await fs.read(name)).get();
        const art = readArtFile(data);
        files.modImmer(fs => {
          const file: NamedArtFile = { name, art, info };
          const idx = fs.findIndex(f => f.name === name);
          if (idx === -1) fs.push(file)
          else fs[idx] = file;
        });
      }
    });
  }

  const loadArtsTask = cookbookInput(typeToken<[FileSystem]>(), (book, input) => {
    const list = book.recepie('Load List', [input], async ([fs]) => fs.list());
    return book.paste([input, list], (handle, [fs], list) => {
      return cookbook(book => {
        const files = list.filter(f => f.name.match(TILES_REGEXP) !== null)
          .map(f => book.recepie(`Loading ${f.name}`, [], async () =>
            fs.read(f.name)
              .then<NamedArtFile>(data => ({ name: f.name.toUpperCase(), art: readArtFile(data.get()), info: f }))))
        return book.recepie('', files, async (...files) => files)
      })(handle);
    });
  });

  return taskHandleContext(handle => {
    const loadArts = (fs: FileSystem) => loadArtsTask(handle(), fs);
    return async (values, res) => values.transformedAsync('art', res, loadArts, nil(), subscriber);
  })
})()

export function loadArtMapWork(values: ValuesContainer, defs: Source<EngineDefs>, arts: Source<NamedArtFile[]>, fs: Source<FileSystem>, pal: Source<Uint8Array>): Task<Source<Map<number, ArtInfoExtended>>> {
  return taskHandleContext(handle => {
    const load = async ([artFiles, defs, fs, pal]: [NamedArtFile[], EngineDefs, FileSystem, Uint8Array]): Promise<Map<number, ArtInfoExtended>> => {
      const map = iter(artFiles)
        .map(file => iter(file.art.arts)
          .enumerate()
          .map(([info, i]) => pair(file.art.header.start + i, { ...info, artFile: file.name })))
        .flatten()
        .toMap(first, second);

      iter(defs.tiles)
        .zip(first(await loadPicAddonsWork(fs, pal, defs.tiles)(handle())))
        .filter(([t, i]) => i.h !== 0 && i.w !== 0)
        .forEach(([t, i]) => map.set(notUndefined(t.picnum), i))

      iter(defs.animTileRanges)
        .forEach(({ start, end, speed, anim }) => {
          const animType = anim ?? AnimationType.NO_ANIMATION;
          const picnum = animType === AnimationType.ANIMATE_BACKWARD ? end : start;
          const frames = Math.abs(start - end);
          const info = map.get(picnum);
          if (info === undefined) return;
          info.attrs = { ...info.attrs, frames, speed, animType };
        });

      return map;
    }
    return () => values.transformedAsyncTuple('artMap', [arts, defs, fs, pal], load);
  })
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

export function loadPicAddonsWork(fs: FileSystem, pal: Uint8Array, files: AddonImageDef[]): Task<ArtInfoExtended[][]> {
  const empty = new Uint8Array();
  const toArtImg = loadToArtImg(pal);
  return cookbook(book => {
    const loadedFiles = files.map(f => book.recepie(`Loading ${f.file}`, [],
      async () => fs.read(f.file ?? '')
        .then(async o => pair(f, await asyncOptional(o.map(loadImageFromBuffer))))))
    return book.paste(loadedFiles, async (handle, ...tuples) => {
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
    });
  });
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
export function loadEditorPicAddons(values: ValuesContainer, artMap: Source<Map<number, ArtInfoExtended>>, fs: Source<FileSystem>, pal: Source<Uint8Array>): Task<AddonArtMap> {
  return cookbook(book => {
    const addons = book.paste([], loadPicAddonsWork(fs.get(), pal.get(), EDITOR_ADDONS));
    return book.recepie('Adding Pic Addons', [addons], async ([infos]) => addArts(values, artMap, infos))
  });
}

export type AddonJsonType = {
  type: 'tc' | 'map' | 'mod',
  id: string,
  game: {
    name: string,
    version?: string,
    crc?: string | number | string[] | number[]
  },
  title: string,
  author?: string,
  description?: string,
  con_main?: string,
  con_modules?: string,
  def_main?: string,
  def_modules?: string,
  rts?: string,
  ini?: string,
  rff_main?: string,
  rff_sound?: string,
}

export function loadAddonJson(values: ValuesContainer, fs: Source<FileSystem>): Promise<Source<AddonJsonType>> {
  return values.transformedAsync('addon.json', fs, async fs => {
    const addon = await fs.read('addon.json');
    return addon
      .map(ab => JSON.parse(new TextDecoder().decode(ab)))
      .orElse({})
  })
}
