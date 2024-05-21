import Optional from "optional-js";
import { Dependency } from "@utils/injector";
import { Disconnector } from "./app1";
import { Consumer } from "@utils/types";

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
  mount(name: string, fs: FileSystem): void;
  list(): string[];
  get(name: string): Optional<FileSystem>;
  subscribe(handler: Consumer<void>): Disconnector;
}

export type FileSystemHandler = (name: string, deleted: boolean) => void;


export const FS = new Dependency<FileSystems>("Filesystems");