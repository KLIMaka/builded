import { Injector, Dependency } from "../../../utils/injector";
import { Storages_ } from "../../apis/app";
import { FileSystem } from "./fs";

export type StorageFsUpdater = (name: string, data: ArrayBuffer) => void;
export const StorageFsUpdater_ = new Dependency<StorageFsUpdater>('StorageFsUpdater');

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

export async function StorageFsUpdaterModule(injector: Injector) {
  const storages = await injector.getInstance(Storages_);
  const fs = await storages(FS_KEY);
  return (name: string, data: ArrayBuffer) => fs.set(name, data);
}