import { Dependency, Injector, provider } from "../../../utils/injector";
import { FileSystem } from "./fs";

export const MOUNTS = new Dependency<FileSystem[]>("Mounts");


export const MountableFs = provider(async (injector: Injector) => {
  return {
    get: async (name: string) => {
      const mounts = await injector.getInstance(MOUNTS);
      for (const mount of mounts) {
        const file = await mount.get(name);
        if (file) return file;
      }
      return null;
    },
    list: async () => {
      const mounts = await injector.getInstance(MOUNTS);
      const files = new Set<string>();
      for (const mount of mounts) {
        const list = await mount.list();
        list.forEach(f => files.add(f));
      }
      return [...files];
    },
  }
});