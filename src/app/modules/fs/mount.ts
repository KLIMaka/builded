import { Dependency, Injector } from "../../../utils/injector";
import { FileProvider } from "./fs";

export const MOUNTS = new Dependency<FileProvider[]>("Mounts", true);

export async function MountableFs(injector: Injector): Promise<FileProvider> {
  return async  name => {
    const mounts = await injector.getInstance(MOUNTS);
    for (const mount of mounts) {
      const file = await mount(name);
      if (file) return file;
    }
    return null;
  }
}