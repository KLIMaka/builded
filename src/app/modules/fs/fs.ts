import { Source, value } from "@utils/callbacks";
import { iter } from "@utils/iter";
import { Consumer, Function, identity, nil, seq } from "@utils/types";
import { RffFile } from "build/formats/rff";
import JSZip from "jszip";
import Optional from "optional-js";
import { Disconnector, HandleProvider, Storage, Storages, Timer } from "../../apis/app1";
import { FileInfo, FileSystem, FileSystemHandler, FileSystems, WritableFileSystem } from "../../apis/fs";
import { GrpFile } from "build/formats/grp";

class FileSystemsImpl implements FileSystems {
  private mounts: Map<string, FileSystem> = new Map();
  private handlers = new HandleProvider<Consumer<void>>();
  private mountNames: string[] = []

  mount(name: string, fs: FileSystem): void {
    this.mounts.set(name, fs);
    this.mountNames = [...this.mounts.keys()];
    this.handlers.get().forEach(h => h());
  }

  list(): string[] {
    return this.mountNames;
  }

  get(name: string): Optional<FileSystem> {
    return Optional.ofNullable(this.mounts.get(name))
  }

  subscribe(handler: any): Disconnector {
    return this.handlers.add(handler);
  }
}

export function DefaultFileSystems(): FileSystems {
  return new FileSystemsImpl();
}

class StubFs implements FileSystem {
  async info(name: string): Promise<Optional<FileInfo>> {
    return Optional.empty();
  }
  async read(name: string): Promise<Optional<ArrayBuffer>> {
    return Optional.empty();
  }
  async list(): Promise<FileInfo[]> {
    return []
  }

  async writable(): Promise<Optional<WritableFileSystem>> {
    return Optional.empty();
  }

  subscribe(handler: FileSystemHandler): Disconnector {
    return nil();
  }

  type(): string {
    return "stub";
  }
}

export const EMPTY: FileSystem = new StubFs();

class BaseFS {
  private handlers = new Set<FileSystemHandler>();
  subscribe(handler: FileSystemHandler): Disconnector {
    if (this.handlers.size === 0) this.firstSubscribed();
    this.handlers.add(handler);
    return seq(() => this.handlers.delete(handler), () => this.check())
  }
  private check() { if (this.handlers.size === 0) this.lastDisconnected() }
  onDelete(name: string) { this.handlers.forEach(h => h(name, true)) }
  onChange(name: string) { this.handlers.forEach(h => h(name, false)) }
  protected firstSubscribed() { }
  protected lastDisconnected() { }
}

class StackFs extends BaseFS implements FileSystem {
  private topDisconnector: Disconnector;
  private bottomDisconnector: Disconnector;

  constructor(
    private top: FileSystem,
    private bottom: FileSystem,
  ) { super() }

  private async call<T>(call: Function<FileSystem, Promise<Optional<T>>>): Promise<Optional<T>> {
    const top = await call(this.top);
    if (top.isPresent()) return top;
    return call(this.bottom);
  }

  async info(name: string): Promise<Optional<FileInfo>> {
    return this.call(fs => fs.info(name));
  }

  async read(name: string): Promise<Optional<ArrayBuffer>> {
    return this.call(fs => fs.read(name));
  }

  async list(): Promise<FileInfo[]> {
    const filesMap = iter(await this.bottom.list()).toMap(f => f.name.toUpperCase(), identity());
    iter(await this.top.list()).forEach(f => filesMap.set(f.name.toUpperCase(), f));
    return [...filesMap.values()];
  }

  async writable(): Promise<Optional<WritableFileSystem>> {
    return this.top.writable()
  }

  protected firstSubscribed(): void {
    this.topDisconnector = this.top.subscribe(async (name, deleted) => {
      if (deleted) this.bottom.info(name).then(file => file.ifPresentOrElse(_ => this.onChange(name), () => this.onDelete(name)));
      else this.onChange(name);
    });
    this.bottomDisconnector = this.bottom.subscribe(async (name, deleted) => {
      if (deleted) this.top.info(name).then(file => file.ifPresentOrElse(nil(), () => this.onDelete(name)));
      else this.top.info(name).then(file => file.ifPresentOrElse(nil(), () => this.onChange(name)));
    });
  }

  protected lastDisconnected(): void {
    this.topDisconnector();
    this.bottomDisconnector();
  }

  type(): string {
    return "stack";
  }
}

export function stack(top: FileSystem, bottom: FileSystem) {
  return new StackFs(top, bottom);
}

class StorageFS extends BaseFS implements FileSystem, WritableFileSystem {
  constructor(private timer: Timer, private filesStorage: Storage, private infoStorage: Storage) { super(); }

  async read(name: string): Promise<Optional<ArrayBuffer>> {
    name = name.toUpperCase();
    return this.filesStorage.get(name);
  }

  async info(name: string): Promise<Optional<FileInfo>> {
    name = name.toUpperCase();
    return this.infoStorage.get<FileInfo>(name);
  }

  async list(): Promise<FileInfo[]> {
    return await this.infoStorage.getAll<FileInfo>();
  }

  async delete(name: string) {
    await this.filesStorage.delete(name);
    await this.infoStorage.delete(name);
    this.onDelete(name);
  }

  async write(name: string, data: ArrayBuffer) {
    await this.filesStorage.set(name, data);
    await this.infoStorage.set(name, { name, size: data.byteLength, lastModified: this.timer() } as FileInfo);
    this.onChange(name);
  }

  async writable(): Promise<Optional<WritableFileSystem>> {
    return Optional.of(this);
  }

  type(): string {
    return 'storage'
  }
}

export async function storageFS(name: string, storages: Storages, timer: Timer): Promise<FileSystem> {
  const files = await storages(`${name}_files`);
  const info = await storages(`${name}_info`);
  return new StorageFS(timer, files, info);
}

type MemoryFile = { data: ArrayBuffer, info: FileInfo }
class InMemoryFS extends BaseFS implements FileSystem {
  private data: Map<string, MemoryFile> = new Map();

  constructor(private timer: Timer) { super(); }

  async info(name: string): Promise<Optional<FileInfo>> {
    return Optional.ofNullable(this.data.get(name.toUpperCase())?.info)
  }

  async read(name: string): Promise<Optional<ArrayBuffer>> {
    return Optional.ofNullable(this.data.get(name.toUpperCase())?.data);
  }

  async list(): Promise<FileInfo[]> {
    return iter(this.data.values()).map(f => f.info).collect();
  }

  async delete(name: string) {
    this.data.delete(name.toUpperCase());
    this.onDelete(name);
  }

  async write(name: string, data: ArrayBuffer) {
    this.data.set(name.toUpperCase(), { data, info: { size: data.byteLength, name, lastModified: this.timer() } })
    this.onChange(name);
  }

  async writable(): Promise<Optional<WritableFileSystem>> {
    return Optional.of(this);
  }

  type(): string {
    return 'memory'
  }
}

export function inMemoryFS(timer: Timer) {
  return new InMemoryFS(timer);
}

class LocalFS extends BaseFS implements FileSystem, WritableFileSystem {
  constructor(private handle: FileSystemDirectoryHandle) { super(); }

  async tryGetFile(file: string): Promise<Optional<File>> {
    try {
      return Optional.of(await (await this.handle.getFileHandle(file)).getFile());
    } catch (e) {
      if (e.name === 'NotFoundError' || e.name === 'TypeError') return Optional.empty();
      throw e;
    }
  }

  async read(name: string): Promise<Optional<ArrayBuffer>> {
    const file = await this.tryGetFile(name);
    if (!file.isPresent()) return Optional.empty();
    return Optional.of(await file.get().arrayBuffer());
  }

  async info(name: string): Promise<Optional<FileInfo>> {
    const file = await this.tryGetFile(name);
    if (!file.isPresent()) return Optional.empty();
    const fileInfo = file.get();
    return Optional.of({ size: fileInfo.size, lastModified: fileInfo.lastModified, name: fileInfo.name });
  }

  async list(): Promise<FileInfo[]> {
    const infos: Promise<FileInfo>[] = [];
    for await (const e of this.handle.values())
      if (e.kind === 'file')
        infos.push(e.getFile().then(f => { return { size: f.size, lastModified: f.lastModified, name: f.name } }));
    return Promise.all(infos)
  }

  async writable(): Promise<Optional<WritableFileSystem>> {
    const permission = await this.handle.requestPermission({ mode: "readwrite" });
    if (permission !== 'granted') return Optional.empty();
    return Optional.of(this);
  }

  async write(name: string, buffer: ArrayBuffer) {
    const fileHandle = await this.handle.getFileHandle(name, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(buffer);
    await writable.close();
    this.onChange(name);
  }

  async delete(name: string) {
    await this.handle.removeEntry(name);
    this.onDelete(name);
  }

  type(): string {
    return 'local'
  }
}

export function createLocalFs(handle: FileSystemDirectoryHandle): FileSystem {
  return new LocalFS(handle);
}

class ZipFS extends BaseFS implements FileSystem {

  constructor(private zip: JSZip) { super(); }

  async read(name: string): Promise<Optional<ArrayBuffer>> {
    const file = this.zip.file(name);
    if (file == null) return Optional.empty();
    return file.async('arraybuffer').then(a => Optional.of(a));
  }

  async info(name: string): Promise<Optional<FileInfo>> {
    const file = this.zip.file(name);
    if (file == null) return Optional.empty();
    return Optional.of({
      name: file.name,
      lastModified: +file.date,
      size: (file as any)._data.uncompressedSize,
    } as FileInfo)
  }

  async list(): Promise<FileInfo[]> {
    const result: FileInfo[] = [];
    this.zip.forEach((rel, file) => {
      if (file.dir) return;
      result.push({
        name: file.name,
        lastModified: +file.date,
        size: (file as any)._data.uncompressedSize
      } as FileInfo)
    });
    return result;
  }

  async writable(): Promise<Optional<WritableFileSystem>> {
    return Optional.empty()
  }

  type(): string {
    return 'zip'
  }
}

export async function createZipFsFile(file: File): Promise<FileSystem> {
  return new ZipFS(await JSZip.loadAsync(file));
}

export async function createZipFsArrayBuffer(file: ArrayBuffer): Promise<FileSystem> {
  return new ZipFS(await JSZip.loadAsync(file));
}

class RffFS extends BaseFS implements FileSystem {
  constructor(private rff: RffFile, private fileLastModified: number = 0) { super() }

  async read(name: string): Promise<Optional<ArrayBuffer>> {
    return Optional.ofNullable(this.rff.get(name));
  }

  async info(name: string): Promise<Optional<FileInfo>> {
    const rec = this.rff.getRecord(name);
    if (!rec) return Optional.empty();
    return Optional.of({ name: rec.filename, size: rec.size, lastModified: this.fileLastModified });
  }

  async list(): Promise<FileInfo[]> {
    return this.rff.fat.map(r => { return { name: r.filename, size: r.size, lastModified: this.fileLastModified } });
  }

  async writable(): Promise<Optional<WritableFileSystem>> {
    return Optional.empty()
  }

  type(): string {
    return 'rff'
  }
}

export async function createRffFs(file: File): Promise<FileSystem> {
  return new RffFS(new RffFile(await file.arrayBuffer()));
}

export function createRffFsArrayBuffer(buffer: ArrayBuffer): FileSystem {
  return new RffFS(new RffFile(buffer));
}

class GrpFS extends BaseFS implements FileSystem {
  constructor(private grp: GrpFile, private fileLastModified: number = 0) { super() }

  async read(name: string): Promise<Optional<ArrayBuffer>> {
    return Optional.ofNullable(this.grp.getArrayBuffer(name));
  }

  async info(name: string): Promise<Optional<FileInfo>> {
    const rec = this.grp.infos.get(name.toLowerCase());
    if (!rec) return Optional.empty();
    return Optional.of({ name: name, size: rec.size, lastModified: this.fileLastModified });
  }

  async list(): Promise<FileInfo[]> {
    return iter(this.grp.infos.entries()).map(([name, info]) => { return { name, size: info.size, lastModified: this.fileLastModified } }).collect();
  }

  async writable(): Promise<Optional<WritableFileSystem>> {
    return Optional.empty()
  }

  type(): string {
    return 'grp'
  }
}

export async function createGrpFs(file: File): Promise<FileSystem> {
  return new GrpFS(new GrpFile(await file.arrayBuffer()));
}

export function createGrpFsArrayuBuffer(buffer: ArrayBuffer): FileSystem {
  return new GrpFS(new GrpFile(buffer));
}

class FetchFs extends BaseFS implements FileSystem {
  constructor(private root: string) { super() }

  async read(name: string): Promise<Optional<ArrayBuffer>> {
    const response = await fetch(`${this.root}/${name}`);
    if (response.ok) return response.arrayBuffer().then(buff => Optional.of(buff))
    else return Optional.empty();
  }

  async info(name: string): Promise<Optional<FileInfo>> {
    return this.read(name)
      .then(f => f.map(f => {
        return {
          name,
          size: f.byteLength,
          lastModified: 0
        } as FileInfo
      }));
  }

  async list(): Promise<FileInfo[]> {
    return [];
  }

  async write(): Promise<Optional<WritableFileSystem>> {
    return Optional.empty();
  }

  type(): string {
    return "fetch"
  }

  async writable(): Promise<Optional<WritableFileSystem>> {
    return Optional.empty()
  }
}

export function fetchFs(root: string) {
  return new FetchFs(root);
}

export async function watchFile(name: string, fs: FileSystem): Promise<Source<Optional<ArrayBuffer>>> {
  fs.subscribe(async (n, _) => { if (name === n) result.set(await fs.read(name)) });
  const result = value(await fs.read(name));
  return result;
}