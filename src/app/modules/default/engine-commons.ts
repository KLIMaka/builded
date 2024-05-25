import { Source, Value, transformed, transformedAsync } from "@utils/callbacks";
import { Function } from "@utils/types";
import { NamedArtFile } from "app/apis/engine";
import { FileSystem } from "app/apis/fs";
import { readArtFile } from "build/formats/art";
import { Draft } from "immer";
import Optional from "optional-js";
import { EMPTY, watchFile } from "../fs/fs";

export async function packegeFs(fs: FileSystem, name: string, factory: Function<ArrayBuffer, Promise<FileSystem>>): Promise<Source<FileSystem>> {
  return transformedAsync(await watchFile(name, fs), async buff => {
    if (!buff.isPresent()) return EMPTY;
    return await factory(buff.get());
  });
}

export async function openFile(name: string, fs: Source<FileSystem>): Promise<Source<ArrayBuffer>> {
  return transformedAsync(fs, fs => fs.read(name).then(opt => opt.orElseThrow(() => new Error(`${name} is missing`))));
}

export async function openFileOptional(name: string, fs: Source<FileSystem>): Promise<Source<Optional<ArrayBuffer>>> {
  return transformedAsync(fs, fs => fs.read(name));
}

export async function loadRaw(src: Source<ArrayBuffer>): Promise<Source<Uint8Array>> {
  return transformed(src, buff => new Uint8Array(buff))
}

const TILES_REGEXP = /TILES\d{3}.ART/i;
async function loadArts(fs: FileSystem): Promise<NamedArtFile[]> {
  return await Promise.all((await fs.list())
    .filter(file => file.name.match(TILES_REGEXP))
    .map(async f => fs.read(f.name)
      .then(data => { return { name: f.name.toUpperCase(), art: readArtFile(data.get()) } })));
}

export async function loadArt(fs: Source<FileSystem>): Promise<Source<NamedArtFile[]>> {
  const addFile = (filesDraft: Draft<NamedArtFile[]>, file: NamedArtFile) => {
    const idx = filesDraft.findIndex(f => f.name === file.name);
    if (idx === -1) filesDraft.push(file)
    else filesDraft[idx] = file;
  }
  const subscriber = (fs: FileSystem, files: Value<NamedArtFile[]>) => {
    return fs.subscribe(async (fn, deleted) => {
      if (fn.match(TILES_REGEXP)) {
        const name = fn.toUpperCase();
        if (deleted) {
          files.mod(fs => fs.filter(f => f.name !== name))
        } else {
          const data = (await fs.read(name)).get();
          const art = readArtFile(data);
          files.modImmer(fs => addFile(fs, { name, art }));
        }
      }
    });
  }
  return transformedAsync(fs, loadArts, subscriber)
}