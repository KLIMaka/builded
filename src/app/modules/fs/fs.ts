import { loadBin } from "../../../utils/getter";
import { Dependency, Injector, InstanceProvider } from "../../../utils/injector";
import { loadZip } from "../../../utils/zip";

export type FileProvider = (name: string) => Promise<ArrayBuffer>;
export const FS = new Dependency<FileProvider>('FileSystem');

export type FileListProvider = () => Promise<string[]>;

export function UrlFs(path: string): InstanceProvider<FileProvider> {
  return async (injector: Injector) => (name: string) => loadBin(path + name)
}

function drag(e) {
  e.stopPropagation();
  e.preventDefault();
}

export function ZipFs(injector: Injector): Promise<FileProvider> {
  return new Promise(resolve => {
    const fileReader = new FileReader();
    const win = document.getElementById("zipfile");
    win.classList.remove('hidden');
    win.addEventListener("dragenter", drag, false);
    win.addEventListener("dragover", drag, false);
    win.addEventListener("drop", (e) => {
      e.stopPropagation();
      e.preventDefault();
      fileReader.readAsArrayBuffer(e.dataTransfer.files[0])
    }, false);
    fileReader.onload = async e => {
      win.classList.add('hidden');
      const zfs = await loadZip(e.target.result);
      const files = Object.keys(zfs.files);
      const nameMap = new Map<string, any>();
      files.forEach(f => nameMap.set(f.toLowerCase(), zfs.file(f)));
      resolve((name: string) => nameMap.get(name.toLowerCase()).async('arraybuffer'));
    }
  })
}
