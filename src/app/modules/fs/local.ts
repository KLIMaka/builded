import { FileSystem, WritableFileSystem } from "./fs";

async function tryGetFile(handle: FileSystemDirectoryHandle, file: string) {
  try {
    return await handle.getFileHandle(file);
  } catch (e) {
    if (e.name == 'NotFoundError') return null;
    throw e;
  }
}

async function createWritable(handle: FileSystemDirectoryHandle): Promise<WritableFileSystem> {
  const permission = await handle.requestPermission({ mode: "readwrite" });
  if (permission != 'granted') return null;
  return {
    delete: async (name: string) => await handle.removeEntry(name),
    write: async (name: string, buffer: ArrayBuffer) => {
      const fileHandle = await handle.getFileHandle(name, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(buffer);
      await writable.close();
    }
  }
}

export async function createLocalFs(handle: FileSystemDirectoryHandle): Promise<FileSystem> {
  const writable = await createWritable(handle);
  return {
    get: async (name: string) => {
      const fhandle = await tryGetFile(handle, name);
      if (fhandle == null) return null;
      const file = await fhandle.getFile();
      return file.arrayBuffer();
    },

    list: async () => {
      const fnames = [];
      for await (const e of handle.values()) if (e.kind == 'file') fnames.push(e.name);
      return fnames
    },

    write: () => writable
  }
}