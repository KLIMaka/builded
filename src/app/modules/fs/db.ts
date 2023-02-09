import { Injector, instance, lifecycle, Module, plugin, provider, RUNTIME } from "../../../utils/injector";
import { Storage, STORAGES } from "../../apis/app";
import { BUS, busDisconnector } from "../../apis/handler";
import { namedMessageHandler } from "../../edit/messages";
import { StorageDbConstructor } from "../db";
import { FileSystem, FS, UrlFs } from "./fs";
import { createLocalFs } from "./local";
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
  const fsinfo = await fsinfoProvider(injector);
  return {
    get: async name => fs.get(name),
    list: async () => fs.keys(),
    write: () => {
      return {
        write: async (name: string, data: ArrayBuffer) => Promise.all([fs.set(name, data), fsinfo.set(name, { size: data.byteLength })]),
        delete: async (name: string) => Promise.all([fs.delete(name), fsinfo.delete(name)]),
      }
    }
  }
}

const RomFs = (rom: string) => provider(async (injector: Injector) => {
  return rom == null ? [] : [await StorageFs(injector), await UrlFs(rom)(injector)];
});

export function DbFsModule(rom: string = null) {
  return (module: Module) => {
    module.bind(STORAGES, StorageDbConstructor);
    module.bind(FS, MountableFs);
    module.bind(MOUNTS, RomFs(rom));

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