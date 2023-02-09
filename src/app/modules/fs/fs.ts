import { loadBin } from "../../../utils/getter";
import { Dependency, Injector, InstanceProvider } from "../../../utils/injector";

export interface WritableFileSystem {
  delete(name: string): Promise<any>;
  write(name: string, data: ArrayBuffer): Promise<any>;
}

export interface FileSystem {
  get(name: string): Promise<ArrayBuffer>
  list(): Promise<string[]>;
  write(): WritableFileSystem;
}
export const FS = new Dependency<FileSystem>('FileSystem');

export type FileListProvider = () => Promise<string[]>;

export function UrlFs(path: string): InstanceProvider<FileSystem> {
  return async (injector: Injector) => {
    return {
      get: async name => loadBin(path + name),
      list: async () => [],
      write: () => { throw new Error(`Read Only FS`) },
    }
  }
}

// export function ZipFs(injector: Injector): Promise<FileProvider> {
//   return new Promise(resolve => {
//     const fileReader = new FileReader();
//     const win = document.getElementById("zipfile");
//     win.classList.remove('hidden');
//     win.addEventListener("dragenter", drag, false);
//     win.addEventListener("dragover", drag, false);
//     win.addEventListener("drop", (e) => {
//       e.stopPropagation();
//       e.preventDefault();
//       fileReader.readAsArrayBuffer(e.dataTransfer.files[0])
//     }, false);
//     fileReader.onload = async e => {
//       win.classList.add('hidden');
//       const zfs = await loadZip(e.target.result);
//       const files = Object.keys(zfs.files);
//       const nameMap = new Map<string, any>();
//       files.forEach(f => nameMap.set(f.toLowerCase(), zfs.file(f)));
//       resolve((name: string) => nameMap.get(name.toLowerCase()).async('arraybuffer'));
//     }
//   })
// }
