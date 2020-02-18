import { Dependency, Injector } from "../../../utils/injector";
import { FileProvider, FS } from "./fs";

export const MOUNTS = new Dependency<FileProvider[]>("Mounts", true);

export async function MountableFs(injector: Injector): Promise<FileProvider> {
  const mounts = await injector.getInstance(MOUNTS);
  return async  name => {
    for (const mount of mounts) {
      const file = await mount(name);
      if (file) return file;
    }
    return null;
  }
}