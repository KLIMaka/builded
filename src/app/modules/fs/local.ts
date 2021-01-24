import { FileSystem } from "./fs";

export async function createLocalFs(handle: FileSystemDirectoryHandle): Promise<FileSystem> {
  return {
    get: async (name: string) => {
      const fhandle = await handle.getFileHandle(name);
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