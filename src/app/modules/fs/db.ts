import { Injector } from "../../../utils/injector";
import { Storages_, Storage } from "../../apis/app";
import { FileSystem } from "./fs";
import { FS_MANAGER, FsManager } from "./manager";
import { MOUNTS } from "./mount";

const FS_KEY = 'filesystem';
const FS_INFO_KEY = 'filesystem-info';

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

let dbfsInfo: Storage;
async function getStorageInfoFs(injector: Injector) {
  if (dbfsInfo == null) {
    const storages = await injector.getInstance(Storages_);
    dbfsInfo = await storages(FS_INFO_KEY);
  }
  return dbfsInfo;
}

async function StorageFsManager(injector: Injector): Promise<FsManager> {
  const fs = await getStorageFs(injector);
  const fsinfo = await getStorageInfoFs(injector);
  return {
    read: name => fs.get(name),
    write: async (name: string, data: ArrayBuffer) => await Promise.all([fs.set(name, data), fsinfo.set(name, { size: data.byteLength })]),
    delete: async name => await Promise.all([fs.delete(name), fsinfo.delete(name)]),
    list: () => fsinfo.keys(),
  }
}

export function DbFsModule(injector: Injector) {
  injector.bind<FileSystem>(MOUNTS, StorageFs);
  injector.bind(FS_MANAGER, StorageFsManager);
}