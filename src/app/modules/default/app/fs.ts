import Optional from "optional-js";
import { FileSystem, FileSystemHandler, FileSystems, WritableFileSystem } from "../../../apis/fs";
import { Storage, Handle } from "../../../apis/app1";

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


class StorageFS implements FileSystem {
  private handlers: Set<FileSystemHandler> = new Set();

  constructor(private storage: Storage) { }

  get(name: string): Promise<Optional<ArrayBuffer>> {
    return this.storage.get(name);
  }

  list(): Promise<string[]> {
    return this.storage.keys();
  }

  write(): Optional<WritableFileSystem> {
    return Optional.of({
      delete: async name => {
        await this.storage.delete(name);
        this.handlers.forEach(h => h.onFileDeleted(this, name));
      },

      write: async (name, data) => {
        await this.storage.set(name, data);
        this.handlers.forEach(h => h.onFileChanged(this, name));
      }
    });
  }

  addHandler(handler: FileSystemHandler): Handle {
    this.handlers.add(handler);
    const remove = () => this.handlers.delete(handler);
    return { remove }
  }
}

export function storageFS(storage: Storage) {
  return new StorageFS(storage);
}

class InMemoryFS implements FileSystem {
  private handlers: Set<FileSystemHandler> = new Set();
  private data: Map<string, ArrayBuffer> = new Map();

  async get(name: string): Promise<Optional<ArrayBuffer>> {
    return Optional.ofNullable(this.data.get(name));
  }

  async list(): Promise<string[]> {
    return [...this.data.keys()];
  }

  write(): Optional<WritableFileSystem> {
    return Optional.of({
      delete: async name => {
        this.data.delete(name);
        this.handlers.forEach(h => h.onFileDeleted(this, name));
      },

      write: async (name, data) => {
        this.data.set(name, data);
        this.handlers.forEach(h => h.onFileChanged(this, name));
      }
    });
  }

  addHandler(handler: FileSystemHandler): Handle {
    this.handlers.add(handler);
    const remove = () => this.handlers.delete(handler);
    return { remove }
  }
}

export function inMemoryFS() {
  return new InMemoryFS();
}