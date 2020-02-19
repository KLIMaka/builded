import { Injector } from "../../../utils/injector";
import { Storages_, Storage } from "../../apis/app";
import { FileSystem } from "./fs";
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

let dbfs: Storage;
async function getStorageFs(injector: Injector) {
  if (dbfs == null) {
    const storages = await injector.getInstance(Storages_);
    dbfs = await storages(FS_KEY);
  }
  return dbfs;
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
  injector.bind<FileSystem>(MOUNTS, StorageFs);
  injector.bind(FS_MANAGER, StorageFsManager);
}