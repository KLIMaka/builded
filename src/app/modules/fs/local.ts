import { FileSystem } from "./fs";

async function tryGetFile(handle: FileSystemDirectoryHandle, file: string) {
  try {
    return await handle.getFileHandle(file);
  } catch (e) {
    if (e.name == 'NotFoundError') return null;
    throw e;
  }
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