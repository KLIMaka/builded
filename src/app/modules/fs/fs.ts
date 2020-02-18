import { loadBin } from "../../../utils/getter";
import { Dependency, Injector, InstanceProvider } from "../../../utils/injector";
import { loadZip } from "../../../utils/zip";

export interface FileInfo {
  readonly name: string;
  readonly size: number;
  readonly source: string;
}

export interface FileSystem {
  get(name: string): Promise<ArrayBuffer>
  info(name: string): Promise<FileInfo>
  list(): Promise<string[]>;
}
export const FS = new Dependency<FileSystem>('FileSystem');

export type FileListProvider = () => Promise<string[]>;

export function UrlFs(path: string): InstanceProvider<FileSystem> {
  return async (injector: Injector) => {
    return {
      get: async (name) => loadBin(path + name),
      list: async () => [],
      info: async (name) => {
        const file = await loadBin(path + name);
        return file ? { name: name, size: file.byteLength, source: 'url' } : null;
      }
    }
  }
}

function drag(e) {
  e.stopPropagation();
  e.preventDefault();
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
