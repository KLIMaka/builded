import { Dependency } from "ts-utils/injector";
import { Fn, Result, Supplier } from "ts-utils/types";
import Optional from "optional-js";
import { Disconnector } from "./app";
import { Disposable } from "ts-utils/callbacks";

export type FileSource = Readonly<{
  name: string,
}> & FileSystem

export type FileInfo = {
  name: string,
  size: number,
  lastModified: number,
  src: FileSource,
}

export interface WritableFileSystem {
  delete(name: string): Promise<void>;
  write(name: string, data: ArrayBuffer): Promise<void>;
}

export interface FileSystem extends Disposable {
  readonly type: SerializedFileSystemHandle['type'];
  readonly name: string;

  info(name: string): Promise<Optional<FileInfo>>;
  read(name: string): Promise<Optional<ArrayBuffer>>;
  list(): Promise<FileInfo[]>;
  writable(): Promise<Optional<WritableFileSystem>>;
  subscribe(handler: FileSystemHandler): Disconnector;
}

export type MemoryFileSystemHandle = { type: 'memory', name: string }
export type StorageFileSystemHandle = { type: 'storage', name: string }
export type DirectoryFileSystemHandle = { type: 'dir', handle: FileSystemDirectoryHandle }
export type FileFileSystemHandle = { type: 'zip' | 'rff' | 'grp', handle: FileSystemFileHandle }
export type StackFileSystemHandle = { type: 'stack', top: SerializedFileSystemHandle, bottom: SerializedFileSystemHandle }
export type HttpFileSystemHandle = { type: 'http', path: string };
export type SerializedFileSystemHandle = MemoryFileSystemHandle | StorageFileSystemHandle | DirectoryFileSystemHandle | FileFileSystemHandle | StackFileSystemHandle | HttpFileSystemHandle;

export type FileSystemHandle = {
  name: string,
  open: Supplier<Promise<Result<FileSystem>>>,
  isSameEntry: Fn<FileSystemHandle, Promise<boolean>>
  serialized: SerializedFileSystemHandle
}
export interface FileSystems {

  deserialize(serialized: SerializedFileSystemHandle): FileSystemHandle;
  pickHandle(src: SerializedFileSystemHandle['type']): Promise<Optional<FileSystemHandle>>;
}

export type FileSystemHandler = (name: string, deleted: boolean) => void;


export const FS = new Dependency<FileSystems>("FileSystems");