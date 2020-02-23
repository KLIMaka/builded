import { Injector } from "../../../utils/injector";
import { STORAGES, Storage } from "../../apis/app";
import { FileSystem, UrlFs, FS } from "./fs";
import { FS_MANAGER, FsManager } from "./manager";
import { MOUNTS, MountableFs } from "./mount";
import { StorageDbConstructor } from "../db";

function createDb(name: string) {
  let db: Storage = null;
  return async (injector: Injector) => {
    if (db == null) {
      const storages = await injector.getInstance(STORAGES);
      db = await storages(name);
    }
    return db;
  }
}

const fsProvider = createDb('filesystem');
const fsinfoProvider = createDb('filesystem-info');

export async function StorageFs(injector: Injector): Promise<FileSystem> {
  const fs = await fsProvider(injector);
  return {
    get: async name => fs.get(name),
    list: async () => fs.keys(),
  }
}

async function StorageFsManager(injector: Injector): Promise<FsManager> {
  const fs = await fsProvider(injector);
  const fsinfo = await fsinfoProvider(injector);
  return {
    read: name => fs.get(name),
    write: async (name: string, data: ArrayBuffer) => await Promise.all([fs.set(name, data), fsinfo.set(name, { size: data.byteLength })]),
    delete: async name => await Promise.all([fs.delete(name), fsinfo.delete(name)]),
    list: () => fsinfo.keys(),
  }
}

export function DbFsModule(rom: string = null) {
  return (injector: Injector) => {
    injector.bind(STORAGES, StorageDbConstructor);
    injector.bind(FS, MountableFs);
    injector.bind<FileSystem>(MOUNTS, StorageFs);
    if (rom != null) injector.bind<FileSystem>(MOUNTS, UrlFs(rom));
    injector.bind(FS_MANAGER, StorageFsManager);
  }
}