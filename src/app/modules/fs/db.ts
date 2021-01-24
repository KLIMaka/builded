import { Injector, instance, Module, plugin, provider } from "../../../utils/injector";
import { Storage, STORAGES } from "../../apis/app";
import { BusPlugin } from "../../apis/handler";
import { namedMessageHandler } from "../../edit/messages";
import { StorageDbConstructor } from "../db";
import { FileSystem, FS, UrlFs } from "./fs";
import { createLocalFs } from "./local";
import { FS_MANAGER } from "./manager";
import { MountableFs, MOUNTS } from "./mount";
import { LocalFsProvider } from "./localmanager";

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

const StorageFsManager = provider(async (injector: Injector) => {
  const fs = await fsProvider(injector);
  const fsinfo = await fsinfoProvider(injector);
  return {
    read: (name: string) => fs.get(name),
    write: async (name: string, data: ArrayBuffer) => await Promise.all([fs.set(name, data), fsinfo.set(name, { size: data.byteLength })]),
    delete: async (name: string) => await Promise.all([fs.delete(name), fsinfo.delete(name)]),
    list: () => fsinfo.keys(),
  }
});

const mounts: FileSystem[] = [];
export function DbFsModule(rom: string = null) {
  return (module: Module) => {
    module.bind(STORAGES, StorageDbConstructor);
    module.bind(FS, LocalFsProvider);
    // module.bind(MOUNTS, instance(() => mounts));
    module.bind(FS_MANAGER, StorageFsManager);

    module.bind(plugin('FileSystem'), new BusPlugin(async (injector, connect) => {
      if (rom != null) mounts.push(await UrlFs(rom)(injector));
      mounts.push(await StorageFs(injector))

      connect(namedMessageHandler('add_mount', async () => {
        mounts.push(await createLocalFs(await window.showDirectoryPicker()))
      }));
    }));
  }
}