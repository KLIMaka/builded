import { Injector, Module } from "../../../utils/injector";
import { STORAGES, Storage } from "../../apis/app";
import { FileSystem, UrlFs, FS } from "./fs";
import { FS_MANAGER, FsManager } from "./manager";
import { MOUNTS, MountableFs } from "./mount";
import { StorageDbConstructor } from "../db";
import { BUS } from "../../apis/handler";
import { namedMessageHandler } from "../../edit/messages";
import { createLocalFs } from "./local";

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

const mounts: FileSystem[] = [];
async function Mounts() {
  return () => mounts;
}

export function DbFsModule(rom: string = null) {
  return (module: Module) => {
    module.bind(STORAGES, StorageDbConstructor);
    module.bind(FS, MountableFs);
    module.bind(MOUNTS, Mounts);
    module.bind(FS_MANAGER, StorageFsManager);

    module.execute(async injector => {
      if (rom != null) mounts.push(await UrlFs(rom)(injector));
      mounts.push(await StorageFs(injector))

      const bus = await injector.getInstance(BUS);
      bus.connect(namedMessageHandler('add_mount', async () => {
        mounts.push(await createLocalFs())
      }));
    });
  }
}