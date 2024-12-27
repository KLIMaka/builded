import { Source, Value, ValuesContainer } from "@utils/callbacks";
import { iter } from "@utils/iter";
import { asyncMapOptional } from "@utils/objects";
import { Function, first, second } from "@utils/types";
import { NOOP_TASK_HANDLE } from "app/apis/app1";
import { ArtInfoExtended, NamedArtFile } from "app/apis/engine";
import { FileSystem } from "app/apis/fs";
import { readArtFile } from "build/formats/art";
import Optional from "optional-js";
import { EMPTY, watchFile } from "../fs/fs";
import { begin } from "../scheduler/work";

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
    .thenPass('Load List', async fs => fs.list())
    .thenWork(async (handle, fs, files) => begin()
      .forkItems(iter(files).filter(f => f.name.match(TILES_REGEXP) !== null),
        f => `Loading ${f.name}`,
        f => fs.read(f.name).then<NamedArtFile>(data => ({ name: f.name.toUpperCase(), art: readArtFile(data.get()) }))
      ).finish()(handle)
    ).finish();

  async function loadArts(fs: FileSystem): Promise<NamedArtFile[]> {
    return first(await loadArtsWork(NOOP_TASK_HANDLE, fs));
  }

  return begin()
    .multiInput<[ValuesContainer, Source<FileSystem>]>()
    .thenWorkPass(async (handle, values, res) => loadArtsWork(handle, res.get()))
    .then('', async (values, res, init) => values.transformedAsyncImmediate('art', res, init, loadArts, subscriber))
    .finishUntuple();
})()

export function loadArtMap(values: ValuesContainer, arts: Source<NamedArtFile[]>) {
  return values.transformed('artMap', arts, artFiles =>
    iter(artFiles)
      .map(file => iter(file.art.arts)
        .enumerate()
        .map(([info, i]) => [file.art.header.start + i, { ...info, artFile: file.name }] as [number, ArtInfoExtended]))
      .flatten()
      .toMap(first, second)
  );
}
