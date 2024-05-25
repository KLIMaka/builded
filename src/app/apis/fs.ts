import { Source } from "@utils/callbacks";
import { Dependency } from "@utils/injector";
import Optional from "optional-js";
import { Disconnector } from "./app1";

export type FileInfo = {
  name: string,
  size: number,
  lastModified: number,
}

export interface WritableFileSystem {
  delete(name: string): Promise<void>;
  write(name: string, data: ArrayBuffer): Promise<void>;
}

export interface FileSystem {
  info(name: string): Promise<Optional<FileInfo>>;
  read(name: string): Promise<Optional<ArrayBuffer>>;
  list(): Promise<FileInfo[]>;
  writable(): Promise<Optional<WritableFileSystem>>;
  subscribe(handler: FileSystemHandler): Disconnector;
  type(): string;
}

export interface FileSystems {
  readonly list: Source<string[]>;

  mount(name: string, fs: FileSystem): void;
  get(name: string): Optional<FileSystem>;
}

export type FileSystemHandler = (name: string, deleted: boolean) => void;


export const FS = new Dependency<FileSystems>("Filesystems");