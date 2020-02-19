import { Injector } from "../../../utils/injector";
import { Storages_ } from "../../apis/app";
import { FileProvider } from "./fs";
import { FS_MANAGER, FsManager } from "./manager";
import { MOUNTS } from "./mount";


const FS_KEY = 'filesystem';

async function getStorageFs(injector: Injector) {
  const storages = await injector.getInstance(Storages_);
  return await storages(FS_KEY);
}

async function StorageFs(injector: Injector): Promise<FileProvider> {
  const fs = await getStorageFs(injector);
  return name => fs.get(name);
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