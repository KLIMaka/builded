import { FileSystem } from "./fs";

export async function createLocalFs(): Promise<FileSystem> {
  const handle = await window.showDirectoryPicker();


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