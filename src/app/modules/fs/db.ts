import { Injector, instance, lifecycle, Module, plugin, provider, RUNTIME } from "../../../utils/injector";
import { Storage, STORAGES } from "../../apis/app";
import { BUS, busDisconnector, BusPlugin } from "../../apis/handler";
import { namedMessageHandler } from "../../edit/messages";
import { StorageDbConstructor } from "../db";
import { FileSystem, FS, UrlFs } from "./fs";
import { createLocalFs } from "./local";
import { FS_MANAGER } from "./manager";
import { MountableFs, MOUNTS } from "./mount";

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

const RomFs = (rom: string) => provider(async (injector: Injector) => {
  return rom == null ? [] : [await UrlFs(rom)(injector)];
});

export function DbFsModule(rom: string = null) {
  return (module: Module) => {
    module.bind(STORAGES, StorageDbConstructor);
    module.bind(FS, MountableFs);
    module.bind(MOUNTS, RomFs(rom));
    module.bind(FS_MANAGER, StorageFsManager);

    module.bind(plugin('FileSystem'), lifecycle(async (injector, lifecycle) => {
      const bus = await injector.getInstance(BUS);
      lifecycle(bus.connect(namedMessageHandler('add_mount', async () => {
        const mounts = await injector.getInstance(MOUNTS);
        const newFs = await createLocalFs(await window.showDirectoryPicker());
        const runtime = await injector.getInstance(RUNTIME);
        runtime.replaceInstance(MOUNTS, instance([newFs, ...mounts]));
      })), busDisconnector(bus));
    }));
  }
}