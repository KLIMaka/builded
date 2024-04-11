import { Source, value } from "@utils/callbacks";
import { RffFile } from "build/formats/rff";
import JSZip from "jszip";
import Optional from "optional-js";
import { Disconnector, HandleProvider, Storage, Storages } from "../../../apis/app1";
import { FileSystem, FileSystemHandler, FileSystems, WritableFileSystem } from "../../../apis/fs";

class FileSystemsImpl implements FileSystems {
  private mounts: Map<string, FileSystem> = new Map();

  mount(name: string, fs: FileSystem): void {
    this.mounts.set(name, fs)
  }

  list(): string[] {
    return [...this.mounts.keys()]
  }

  get(name: string): Optional<FileSystem> {
    return Optional.ofNullable(this.mounts.get(name))
  }
}

export function DefaultFileSystems(): FileSystems {
  return new FileSystemsImpl();
}

class BaseFS {
  private handlers = new HandleProvider<FileSystemHandler>();
  addHandler(handler: FileSystemHandler): Disconnector { return this.handlers.add(handler) }
  onDelete(name: string) { this.handlers.get().forEach(h => h(name, false)) }
  onChange(name: string) { this.handlers.get().forEach(h => h(name, true)) }
}


type InfoType = { size: number };
class StorageFS extends BaseFS implements FileSystem {
  constructor(private files: Storage, private info: Storage) { super(); }

  get(name: string): Promise<Optional<ArrayBuffer>> {
    name = name.toUpperCase();
    return this.files.get(name);
  }

  async list(): Promise<string[]> {
    return this.files.keys();
  }

  async getSize(name: string): Promise<Optional<number>> {
    return (await this.info.get<InfoType>(name)).map(i => i.size);
  }

  async write(): Promise<Optional<WritableFileSystem>> {
    return Optional.of({
      delete: async name => {
        await this.files.delete(name);
        await this.info.delete(name);
        this.onDelete(name);
      },

      write: async (name, data) => {
        await this.files.set(name, data);
        await this.info.set(name, { size: data.byteLength });
        this.onChange(name);
      }
    });
  }
}

export async function storageFS(name: string, storages: Storages): Promise<FileSystem> {
  const files = await storages(`${name}_files`);
  const info = await storages(`${name}_info`);
  return new StorageFS(files, info);
}

class InMemoryFS extends BaseFS implements FileSystem {
  private data: Map<string, ArrayBuffer> = new Map();

  async get(name: string): Promise<Optional<ArrayBuffer>> {
    return Optional.ofNullable(this.data.get(name));
  }

  async list(): Promise<string[]> {
    return [...this.data.keys()];
  }

  async getSize(name: string): Promise<Optional<number>> {
    return Optional.ofNullable(this.data.get(name)?.byteLength);
  }

  async write(): Promise<Optional<WritableFileSystem>> {
    return Optional.of({
      delete: async name => {
        this.data.delete(name);
        this.onDelete(name);
      },

      write: async (name, data) => {
        this.data.set(name, data);
        this.onChange(name);
      }
    });
  }
}

export function inMemoryFS() {
  return new InMemoryFS();
}

class LocalFS extends BaseFS implements FileSystem {
  constructor(private handle: FileSystemDirectoryHandle) { super(); }

  async tryGetFile(file: string): Promise<Optional<FileSystemFileHandle>> {
    try {
      return Optional.ofNullable(await this.handle.getFileHandle(file));
    } catch (e) {
      if (e.name == 'NotFoundError') return Optional.empty();
      throw e;
    }
  }

  async get(name: string): Promise<Optional<ArrayBuffer>> {
    const file = await this.tryGetFile(name);
    if (!file.isPresent()) return Optional.empty();
    const data = await file.get().getFile().then(f => f.arrayBuffer());
    return Optional.of(data);
  }

  async getSize(name: string): Promise<Optional<number>> {
    const file = await this.tryGetFile(name);
    if (!file.isPresent()) return Optional.empty();
    const size = await file.get().getFile().then(f => f.size);
    return Optional.of(size);
  }

  async list(): Promise<string[]> {
    const fnames = [];
    for await (const e of this.handle.values()) if (e.kind == 'file') fnames.push(e.name);
    return fnames
  }

  async write(): Promise<Optional<WritableFileSystem>> {
    const permission = await this.handle.requestPermission({ mode: "readwrite" });
    if (permission != 'granted') return Optional.empty();
    return Optional.of({
      delete: async (name: string) => {
        await this.handle.removeEntry(name);
        this.onDelete(name);
      },

      write: async (name: string, buffer: ArrayBuffer) => {
        const fileHandle = await this.handle.getFileHandle(name, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(buffer);
        await writable.close();
        this.onChange(name);
      }
    });
  }
}


export function createLocalFs(handle: FileSystemDirectoryHandle): FileSystem {
  return new LocalFS(handle);
}

class ZipFS extends BaseFS implements FileSystem {

  constructor(private zip: JSZip) { super(); }

  async get(name: string): Promise<Optional<ArrayBuffer>> {
    const file = this.zip.file(name);
    if (file == null) return Optional.empty();
    return file.async('arraybuffer').then(a => Optional.of(a));
  }

  async getSize(name: string): Promise<Optional<number>> {
    const file = this.zip.file(name);
    if (file == null) return Optional.empty();
    return file.async('arraybuffer').then(a => Optional.of(a.byteLength));
  }

  async list(): Promise<string[]> {
    const result: string[] = [];
    this.zip.forEach((rel, file) => result.push(file.name));
    return result;
  }

  async write(): Promise<Optional<WritableFileSystem>> {
    return Optional.empty();
  }
}

export async function createZipFs(file: File): Promise<FileSystem> {
  return new ZipFS(await JSZip.loadAsync(file));
}

class RffFS extends BaseFS implements FileSystem {
  constructor(private rff: RffFile) { super() }

  async get(name: string): Promise<Optional<ArrayBuffer>> {
    return Optional.ofNullable(this.rff.get(name));
  }

  async getSize(name: string): Promise<Optional<number>> {
    const record = this.rff.getRecord(name);
    if (record == null) return Optional.empty();
    return Optional.of(record.size);
  }

  async list(): Promise<string[]> {
    return this.rff.fat.map(r => r.filename);
  }

  async write(): Promise<Optional<WritableFileSystem>> {
    return Optional.empty();
  }
}

export async function createRffFs(file: File): Promise<FileSystem> {
  return new RffFS(new RffFile(await file.arrayBuffer()));
}

class FetchFs extends BaseFS implements FileSystem {
  constructor(private root: string) { super() }

  async get(name: string): Promise<Optional<ArrayBuffer>> {
    const response = await fetch(`${this.root}/${name}`);
    if (response.ok) return response.arrayBuffer().then(buff => Optional.of(buff))
  }

  async getSize(name: string): Promise<Optional<number>> {
    return Optional.empty();
  }

  async list(): Promise<string[]> {
    return [];
  }

  async write(): Promise<Optional<WritableFileSystem>> {
    return Optional.empty();
  }
}

export function fetchFs(root: string) {
  return new FetchFs(root);
}

export async function watchFile(name: string, fs: FileSystem): Promise<Source<Optional<ArrayBuffer>>> {
  fs.addHandler(async (n, _) => { if (name == n) result.set(await fs.get(name)) });
  const result = value(await fs.get(name));
  return result;
}