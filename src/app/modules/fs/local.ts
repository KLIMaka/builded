import { FileSystem } from "./fs";

function tryGetFile(handle: FileSystemDirectoryHandle, file: string) {
  return new Promise<FileSystemFileHandle>(resolve => handle.getFileHandle(file).then(resolve).catch(() => resolve(null)));
}

export async function createLocalFs(handle: FileSystemDirectoryHandle): Promise<FileSystem> {
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
    }
  }
}