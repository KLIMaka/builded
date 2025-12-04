import { ACTION_DESCRIPTORS, ActionDescriptors } from "app/apis/actions";
import { Ui, UI } from "app/apis/ui";
import { VALUES, Values } from "app/apis/values";
import { GrpFile } from "build/formats/grp";
import { RffFile } from "build/formats/rff";
import JSZip from "jszip";
import Optional from "optional-js";
import { match } from "ts-pattern";
import { BaseValue, Source, Value, ValuesContainer } from "ts-utils/callbacks";
import { getOrCreate } from "ts-utils/collections";
import { getInstances, Plugin, provider } from "ts-utils/injector";
import { iter } from "ts-utils/iter";
import { asyncMapOptional, strcmpci as streqci } from "ts-utils/objects";
import { Stream } from "ts-utils/stream";
import { BiFunction, Function, identity, nil, notUndefined, Result, resultAsync, seq, SingleTuple } from "ts-utils/types";
import { App, APP, Disconnector, Storage, Storages, Timer } from "../../apis/app";
import { DirectoryFileSystemHandle, FileFileSystemHandle, FileInfo, FileSource, FileSystem, FileSystemHandle, FileSystemHandler, FileSystems, HttpFileSystemHandle, MemoryFileSystemHandle, SerializedFileSystemHandle, StackFileSystemHandle, StorageFileSystemHandle, WritableFileSystem } from "../../apis/fs";
import { selectStorageFs } from "./ui/select-storage";

async function pickDir(): Promise<Optional<DirectoryFileSystemHandle>> {
  try {
    const handle = await window.showDirectoryPicker();
    return Optional.of({ type: 'dir', handle });
  } catch {
    return Optional.empty();
  }
}

async function pickFile(
  type: 'rff' | 'zip' | 'grp'
): Promise<Optional<FileFileSystemHandle>> {
  try {
    const pickType = match(type)
      .returnType<FilePickerAcceptType>()
      .with('grp', () => ({ description: 'Grp File', accept: { 'application/grp': '.grp' } }))
      .with('zip', () => ({ description: 'Zip File', accept: { 'application/zip': '.zip' } }))
      .with('rff', () => ({ description: 'Rff File', accept: { 'application/rff': '.rff' } }))
      .exhaustive();
    const [handle] = await window.showOpenFilePicker({ types: [pickType] });
    return Optional.of({ type, handle });
  } catch {
    return Optional.empty();
  }
}

async function requestPermissions<T extends FileSystemFileHandle | FileSystemDirectoryHandle>(handle: T): Promise<T> {
  const permission = await handle.requestPermission();
  if (permission !== 'granted') throw new Error(`Permission on ${handle.name} is not granted`)
  return handle;
}


class FileSystemHandleImpl<T extends SerializedFileSystemHandle> implements FileSystemHandle {
  constructor(
    public name: string,
    public serialized: T,
    private doOpen: Function<FileSystemHandle, Promise<FileSystem>>,
    private isSame: Function<FileSystemHandle, Promise<boolean>>
  ) { }

  async open(): Promise<Result<FileSystem>> {
    return resultAsync(() => this.doOpen(this))
  }

  isSameEntry(handle: FileSystemHandle): Promise<boolean> {
    return this.isSame(handle);
  }
}

class FileSystemsImpl implements FileSystems {
  constructor(
    private app: App,
    private values: Values,
    private ui: Ui,
    private aDescriptors: ActionDescriptors,
  ) { }

  deserialize(serialized: SerializedFileSystemHandle): FileSystemHandle {
    return match(serialized)
      .with({ type: 'storage' }, s => this.createStorage(s))
      .with({ type: 'memory' }, s => this.createMemory(s))
      .with({ type: 'dir' }, s => this.createDir(s))
      .with({ type: 'zip' }, s => this.createFile(s, createZipFsFile))
      .with({ type: 'rff' }, s => this.createFile(s, createRffFs))
      .with({ type: 'grp' }, s => this.createFile(s, createGrpFs))
      .with({ type: 'stack' }, s => this.createStack(s))
      .with({ type: 'http' }, s => this.createHttp(s))
      .exhaustive()
  }

  async pickHandle(src: SerializedFileSystemHandle['type']): Promise<Optional<FileSystemHandle>> {
    return match(src)
      .returnType<Promise<Optional<FileSystemHandle>>>()
      .with('storage', async () => (await this.pickStorage()).map(name => this.deserialize({ type: 'storage', name })))
      .with('memory', async () => Optional.of(this.deserialize({ type: 'memory', name: 'inMemory' })))
      .with('dir', async () => (await pickDir()).map(d => this.deserialize(d)))
      .with('zip', async () => (await pickFile('zip')).map(d => this.deserialize(d)))
      .with('rff', async () => (await pickFile('rff')).map(d => this.deserialize(d)))
      .with('grp', async () => (await pickFile('grp')).map(d => this.deserialize(d)))
      .with('http', async () => Optional.of(this.deserialize({ type: 'http', path: '' })))
      .with('stack', async () => Optional.empty())
      .exhaustive();
  }

  private async pickStorage(): Promise<Optional<string>> {
    return selectStorageFs(this.app, this.ui, this.aDescriptors, this.values, this)
  }

  private createStorage(serialized: StorageFileSystemHandle): FileSystemHandle {
    return new FileSystemHandleImpl(
      serialized.name,
      serialized,
      async h => storageFS(serialized.name, this.app.storages, this.app.timer),
      async h => h.serialized.type === 'storage' && h.serialized.name === serialized.name
    );
  }

  private createDir(serialized: DirectoryFileSystemHandle): FileSystemHandle {
    return new FileSystemHandleImpl(
      serialized.handle.name,
      serialized,
      async h => requestPermissions(serialized.handle).then(fh => createLocalFs(fh)),
      async h => h.serialized.type === 'dir' && await h.serialized.handle.isSameEntry(serialized.handle)
    )
  }

  private createFile(serialized: FileFileSystemHandle, factory: Function<File, Promise<FileSystem>>): FileSystemHandle {
    return new FileSystemHandleImpl(
      serialized.handle.name,
      serialized,
      async h => requestPermissions(serialized.handle).then(fh => fh.getFile()).then(fh => factory(fh)),
      async h => h.serialized.type === serialized.type && await h.serialized.handle.isSameEntry(serialized.handle)
    );
  }

  private createMemory(serialized: MemoryFileSystemHandle): FileSystemHandle {
    return new FileSystemHandleImpl(
      serialized.name,
      serialized,
      async h => inMemoryFS(serialized.name, this.app.timer),
      async h => h.serialized.type === 'memory' && serialized.name === h.name
    );
  }

  private createStack(serialized: StackFileSystemHandle): FileSystemHandle {
    const topHandle = this.deserialize(serialized.top);
    const bottomHandle = this.deserialize(serialized.bottom);
    return new FileSystemHandleImpl(
      'stack',
      serialized,
      async h => Promise.all([topHandle.open(), bottomHandle.open()]).then(([top, bottom]) => stack(top.unwrap(), bottom.unwrap())),
      async h => h.serialized.type === 'stack' && await Promise.all([this.deserialize(h.serialized.top).isSameEntry(topHandle), this.deserialize(h.serialized.bottom).isSameEntry(bottomHandle)]).then(([t, b]) => t && b)
    )
  }

  private createHttp(serialized: HttpFileSystemHandle): FileSystemHandle {
    return new FileSystemHandleImpl(
      serialized.path,
      serialized,
      async h => httpFs(serialized.path),
      async h => h.serialized.type === 'http' && serialized.path === h.name
    )
  }
}

export const DefaultFileSystemsConstructor: Plugin<FileSystems> = provider(async injector => {
  const [app, ui, aDescriptors, values] = await getInstances(injector, APP, UI, ACTION_DESCRIPTORS, VALUES);
  return new FileSystemsImpl(app, values, ui, aDescriptors);
});

class StubFs implements FileSystem {
  readonly type = 'memory';
  readonly name = 'stub';

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

  async dispose(): Promise<void> { }
}

export const EMPTY: FileSystem = new StubFs();
export let GLOBAL_FS_HANDLERS = 0;

abstract class BaseFS implements FileSystem {

  constructor(
    readonly type: SerializedFileSystemHandle['type'],
    readonly name: string,
    private handlers = new Set<FileSystemHandler>()) {
  }
  abstract info(name: string): Promise<Optional<FileInfo>>;
  abstract read(name: string): Promise<Optional<ArrayBuffer>>;
  abstract list(): Promise<FileInfo[]>;
  abstract writable(): Promise<Optional<WritableFileSystem>>;


  subscribe(handler: FileSystemHandler): Disconnector {
    GLOBAL_FS_HANDLERS++;
    if (this.handlers.size === 0) this.firstSubscribed();
    this.handlers.add(handler);
    return seq(() => { GLOBAL_FS_HANDLERS--; this.handlers.delete(handler) }, () => this.check())
  }

  private check() {
    if (this.handlers.size === 0) this.lastDisconnected()
  }

  onDelete(name: string) {
    this.handlers.forEach(h => h(name, true))
  }

  onChange(name: string) {
    this.handlers.forEach(h => h(name, false))
  }

  async dispose(): Promise<void> { }
  protected firstSubscribed() { }
  protected lastDisconnected() { }
}

class StackFs extends BaseFS implements FileSystem {
  private topDisconnector: Disconnector | undefined;
  private bottomDisconnector: Disconnector | undefined;

  constructor(
    private top: FileSystem,
    private bottom: FileSystem,
  ) {
    super('stack', 'stack')
  }

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
    const top = await this.top.writable();
    const bottom = await this.bottom.writable();
    return top.or(() => bottom);
  }

  protected firstSubscribed(): void {
    this.topDisconnector = this.top.subscribe((name, deleted) => {
      if (deleted) this.bottom.info(name).then(file => file.ifPresentOrElse(_ => this.onChange(name), () => this.onDelete(name)));
      else this.onChange(name);
    });
    this.bottomDisconnector = this.bottom.subscribe((name, deleted) => {
      if (deleted) this.top.info(name).then(file => file.ifPresentOrElse(nil(), () => this.onDelete(name)));
      else this.top.info(name).then(file => file.ifPresentOrElse(nil(), () => this.onChange(name)));
    });
  }

  protected lastDisconnected(): void {
    this.topDisconnector?.();
    this.bottomDisconnector?.();
  }

  async dispose(): Promise<void> {
    await Promise.all([this.top.dispose(), this.bottom.dispose()]);
  }
}

export function stack(top: FileSystem, bottom: FileSystem) {
  return new StackFs(top, bottom);
}



class StorageFS extends BaseFS implements FileSystem, WritableFileSystem, FileSource {
  constructor(
    name: string,
    private timer: Timer,
    private filesStorage: Storage,
    private infoStorage: Storage) {
    super('storage', name);
  }

  async read(name: string): Promise<Optional<ArrayBuffer>> {
    return this.filesStorage.get(name);
  }

  async info(name: string): Promise<Optional<FileInfo>> {
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
    await this.infoStorage.set(name, { name, size: data.byteLength, lastModified: this.timer.now() } as FileInfo);
    this.onChange(name);
  }

  async writable(): Promise<Optional<WritableFileSystem>> {
    return Optional.of(this);
  }

  async dispose(): Promise<void> {
    // await Promise.all([this.filesStorage.dispose(), this.infoStorage.dispose()]);
  }
}
const ACTIVE_STORAGE_FS = new Map<string, Promise<StorageFS>>();
export async function storageFS(name: string, storages: Storages, timer: Timer): Promise<StorageFS> {
  return getOrCreate(ACTIVE_STORAGE_FS, name, async _ => {
    const files = await storages(`${name}_files`);
    const info = await storages(`${name}_info`);
    return new StorageFS(name, timer, files, info);
  })
}

type MemoryFile = { data: ArrayBuffer, info: FileInfo }
class InMemoryFS extends BaseFS implements FileSystem, FileSource {
  private data: Map<string, MemoryFile> = new Map();

  constructor(
    name: string,
    private timer: Timer,
  ) {
    super('memory', name);
  }

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
    this.data.set(name.toUpperCase(), { data, info: { size: data.byteLength, name, lastModified: this.timer.now(), src: this } })
    this.onChange(name);
  }

  async writable(): Promise<Optional<WritableFileSystem>> {
    return Optional.of(this);
  }
}

export function inMemoryFS(name: string, timer: Timer) {
  return new InMemoryFS(name, timer);
}

class LocalFS extends BaseFS implements FileSystem, WritableFileSystem, FileSource {
  constructor(
    private directoryHandle: FileSystemDirectoryHandle,
  ) {
    super('dir', directoryHandle.name);
  }

  private async getChain(root: FileSystemDirectoryHandle, chain: string[]): Promise<FileSystemFileHandle> {
    if (chain.length === 0) throw new Error();
    else if (chain[0] === '') {
      chain.shift();
      return this.getChain(root, chain);
    } else if (chain.length === 1) {
      return root.getFileHandle(chain[0]);
    } else {
      const dir = notUndefined(chain.shift());
      return this.getChain(await root.getDirectoryHandle(dir), chain);
    }
  }

  private async tryGetFile(file: string): Promise<Optional<File>> {
    try {
      const handle = await this.getChain(this.directoryHandle, file.split('/'));
      const content = await handle.getFile();
      return Optional.of(content);
    } catch (e: any) {
      if (e.name === 'NotFoundError' || e.name === 'TypeError') return Optional.empty();
      throw e;
    }
  }

  async read(name: string): Promise<Optional<ArrayBuffer>> {
    const file = await this.tryGetFile(name);
    return asyncMapOptional(file, file => file.arrayBuffer());
  }

  async info(name: string): Promise<Optional<FileInfo>> {
    const file = await this.tryGetFile(name);
    if (!file.isPresent()) return Optional.empty();
    const fileInfo = file.get();
    return Optional.of({ size: fileInfo.size, lastModified: fileInfo.lastModified, name: fileInfo.name, src: this });
  }

  async list(): Promise<FileInfo[]> {
    const infos: Promise<FileInfo>[] = [];
    for await (const e of this.directoryHandle.values())
      if (e.kind === 'file')
        infos.push(e.getFile().then(f => { return { size: f.size, lastModified: f.lastModified, name: f.name, src: this } }));
    return Promise.all(infos)
  }

  async writable(): Promise<Optional<WritableFileSystem>> {
    const permission = await this.directoryHandle.requestPermission({ mode: "readwrite" });
    if (permission !== 'granted') return Optional.empty();
    return Optional.of(this);
  }

  async write(name: string, buffer: ArrayBuffer) {
    const fileHandle = await this.directoryHandle.getFileHandle(name, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(buffer);
    await writable.close();
    this.onChange(name);
  }

  async delete(name: string) {
    await this.directoryHandle.removeEntry(name);
    this.onDelete(name);
  }
}

export function createLocalFs(dirHandle: FileSystemDirectoryHandle) {
  return new LocalFS(dirHandle);
}

class ZipFS extends BaseFS implements FileSystem, FileSource {

  constructor(
    name: string,
    private zip: JSZip,
  ) {
    super("zip", name);
  }

  async read(name: string): Promise<Optional<ArrayBuffer>> {
    const file = this.zip.file(new RegExp(name, 'i'));
    if (file.length === 0) return Optional.empty();
    return file[0].async('arraybuffer').then(a => Optional.of(a));
  }

  async info(name: string): Promise<Optional<FileInfo>> {
    const file = this.zip.file(new RegExp(name, 'i'));
    if (file.length === 0) return Optional.empty();
    return Optional.of({
      name: file[0].name,
      lastModified: +file[0].date,
      size: (file as any)._data.uncompressedSize,
      src: this
    })
  }

  async list(): Promise<FileInfo[]> {
    const result: FileInfo[] = [];
    this.zip.forEach((rel, file) => {
      if (file.dir) return;
      result.push({
        name: file.name,
        lastModified: +file.date,
        size: (file as any)._data.uncompressedSize,
        src: this
      })
    });
    return result;
  }

  async writable(): Promise<Optional<WritableFileSystem>> {
    return Optional.empty()
  }
}

export async function createZipFsFile(file: File): Promise<ZipFS> {
  return new ZipFS(file.name, await JSZip.loadAsync(file));
}

export async function createZipFsArrayBuffer(name: string, file: ArrayBuffer): Promise<FileSystem> {
  return new ZipFS(name, await JSZip.loadAsync(file));
}

export async function createGrpOrZipFsArrayBuffer(name: string, file: ArrayBuffer): Promise<FileSystem> {
  const stream = new Stream(file);
  return (stream.readByteString(12) === 'KenSilverman')
    ? createGrpFsArrayBuffer(name, file)
    : createZipFsArrayBuffer(name, file);
}

class RffFS extends BaseFS implements FileSystem, FileSource {
  constructor(
    name: string,
    private rff: RffFile,
    private fileLastModified: number = 0,
  ) {
    super('rff', name)
  }

  async read(name: string): Promise<Optional<ArrayBuffer>> {
    return this.rff.getByName(name);
  }

  async info(name: string): Promise<Optional<FileInfo>> {
    return this.rff.getRecord(name)
      .map(rec => ({ name: rec.filename, size: rec.size, lastModified: this.fileLastModified, src: this }));
  }

  async list(): Promise<FileInfo[]> {
    return this.rff.fat.map(r => { return { name: r.filename, size: r.size, lastModified: this.fileLastModified, src: this } });
  }

  async writable(): Promise<Optional<WritableFileSystem>> {
    return Optional.empty()
  }
}

export async function createRffFs(file: File): Promise<RffFS> {
  return new RffFS(file.name, new RffFile(await file.arrayBuffer()));
}

export function createRffFsArrayBuffer(name: string, buffer: ArrayBuffer): FileSystem {
  return new RffFS(name, new RffFile(buffer));
}

class GrpFS extends BaseFS implements FileSystem, FileSource {
  constructor(
    name: string,
    private grp: GrpFile,
    private fileLastModified: number = 0,
  ) {
    super('grp', name);
  }

  async read(name: string): Promise<Optional<ArrayBuffer>> {
    return Optional.ofNullable(this.grp.getArrayBuffer(name));
  }

  async info(name: string): Promise<Optional<FileInfo>> {
    const rec = this.grp.infos.get(name.toLowerCase());
    if (!rec) return Optional.empty();
    return Optional.of({ name: name, size: rec.size, lastModified: this.fileLastModified, src: this });
  }

  async list(): Promise<FileInfo[]> {
    return iter(this.grp.infos.entries()).map(([name, info]) => { return { name, size: info.size, lastModified: this.fileLastModified, src: this } }).collect();
  }

  async writable(): Promise<Optional<WritableFileSystem>> {
    return Optional.empty()
  }
}

export async function createGrpFs(file: File): Promise<GrpFS> {
  return new GrpFS(file.name, new GrpFile(await file.arrayBuffer()));
}

export function createGrpFsArrayBuffer(name: string, buffer: ArrayBuffer): FileSystem {
  return new GrpFS(name, new GrpFile(buffer));
}

class HttpFs extends BaseFS {
  constructor(
    private basePath: string,
  ) {
    super('http', basePath);
  }

  async info(name: string): Promise<Optional<FileInfo>> {
    return Optional.empty();
  }

  async read(name: string): Promise<Optional<ArrayBuffer>> {
    return fetch(`${this.basePath}/${name}`)
      .then(async r => (!r.ok) ? Optional.empty() : Optional.of(await r.arrayBuffer()))
  }

  async list(): Promise<FileInfo[]> {
    return [];
  }

  async writable(): Promise<Optional<WritableFileSystem>> {
    return Optional.empty()
  }
}

export function httpFs(path: string): FileSystem {
  return new HttpFs(path);
}

export async function watchFile(values: ValuesContainer, name: string, fs: Source<FileSystem>): Promise<Source<Optional<ArrayBuffer>>> {
  const srcConnector = (fs: FileSystem, file: Value<Optional<ArrayBuffer>>): Disconnector => {
    return fs.subscribe(async (changed, deleted) => {
      if (!streqci(name, changed)) return;
      if (deleted) file.set(Optional.empty())
      else file.set(await fs.read(name));
    })
  }
  return values.transformedAsync<FileSystem, Optional<ArrayBuffer>>(`watch file '${name}'`, fs, async fs => fs.read(name), nil(), srcConnector)
}

export function trackFiles<Args extends any[], T>(
  files: Iterable<string>,
  selector: Function<SingleTuple<Args>, FileSystem>,
  reloader: Function<SingleTuple<Args>, Promise<T>>
): BiFunction<SingleTuple<Args>, BaseValue<T>, Disconnector> {
  return (fs, value) => selector(fs).subscribe((changed, _) => {
    if (iter(files).all(f => !streqci(f, changed))) return;
    value.setPromiseOrDispose(_ => reloader(fs))
  })
}

export function trackFilesSingle<T>(files: Iterable<string>, reloader: Function<FileSystem, Promise<T>>): BiFunction<FileSystem, BaseValue<T>, Disconnector> {
  return trackFiles<[FileSystem], T>(files, identity(), reloader);
}