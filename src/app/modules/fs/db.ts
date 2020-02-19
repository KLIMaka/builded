import { Injector } from "../../../utils/injector";
import { Storages_ } from "../../apis/app";
import { FileSystem } from "./fs";
import { FileProvider } from "./fs";
import { FS_MANAGER, FsManager } from "./manager";
import { MOUNTS } from "./mount";


const FS_KEY = 'filesystem';

export async function StorageFs(injector: Injector): Promise<FileSystem> {
  const storages = await injector.getInstance(Storages_);
  const fs = await storages(FS_KEY);
  return {
    get: async name => fs.get(name),
    list: async () => fs.keys(),
    info: async name => {
      const file = await fs.get(name);
      return file ? { name: name, size: file.byteLength, source: "storage" } : null
    }
  }
}

async function StorageFsManager(injector: Injector): Promise<FsManager> {
  const fs = await getStorageFs(injector);
  return {
    read: name => fs.get(name),
    write: (name: string, data: ArrayBuffer) => fs.set(name, data),
    delete: name => fs.delete(name),
    list: () => fs.keys(),
  }
}

export function DbFsModule(injector: Injector) {
  injector.bind<FileProvider>(MOUNTS, StorageFs);
  injector.bind(FS_MANAGER, StorageFsManager);
}