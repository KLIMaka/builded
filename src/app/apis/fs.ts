import Optional from "optional-js";
import { Dependency } from "@utils/injector";
import { Disconnector } from "./app1";

export interface WritableFileSystem {
  delete(name: string): Promise<void>;
  write(name: string, data: ArrayBuffer): Promise<void>;
}

export interface FileSystem {
  get(name: string): Promise<Optional<ArrayBuffer>>;
  getSize(name: string): Promise<Optional<number>>;
  list(): Promise<string[]>;
  write(): Promise<Optional<WritableFileSystem>>;
  addHandler(handler: FileSystemHandler): Disconnector;
}

export interface FileSystems {
  mount(name: string, fs: FileSystem): void;
  list(): string[];
  get(name: string): Optional<FileSystem>;
}

export type FileSystemHandler = (name: string, deleted: boolean) => void;


export const FS = new Dependency<FileSystems>("Filesystems");