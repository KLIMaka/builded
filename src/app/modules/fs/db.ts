import { Injector, Dependency } from "../../../utils/injector";
import { Storages_ } from "../../apis/app";
import { FileProvider } from "./fs";

export type StorageFsUpdater = (name: string, data: ArrayBuffer) => void;
export const StorageFsUpdater_ = new Dependency<StorageFsUpdater>('StorageFsUpdater');

const FS_KEY = 'filesystem';

export async function StorageFs(injector: Injector): Promise<FileProvider> {
  const storages = await injector.getInstance(Storages_);
  const fs = await storages(FS_KEY);
  return name => fs.get(name);
}

export async function StorageFsUpdaterModule(injector: Injector) {
  const storages = await injector.getInstance(Storages_);
  const fs = await storages(FS_KEY);
  return (name: string, data: ArrayBuffer) => fs.set(name, data);
}