import Optional from "optional-js";
import { Dependency } from "utils/injector";

export interface WritableFileSystem {
  delete(name: string): Promise<void>;
  write(name: string, data: ArrayBuffer): Promise<void>;
}

export interface FileSystem {
  get(name: string): Promise<Optional<ArrayBuffer>>
  list(): Promise<string[]>;
  write(): Optional<WritableFileSystem>;
  addHandler(handler: FileSystemHandler): Handle;
}

export interface FileSystems {
  mount(name: string, fs: FileSystem): void;
  list(): string[];
  get(name: string): Optional<FileSystem>;
}

export interface FileSystemHandler {
  onFileChanged(fs: FileSystem, name: string): Promise<void>;
  onFileDeleted(fs: FileSystem, name: String): Promise<void>;
}

export const FS = new Dependency<FileSystems>("Filesystems");