import * as loadJSZip from "../../libs_js/jszip";
import { Dependency, Injector } from "../../utils/injector";
import { loadBin } from "../../utils/getter";
import { Storage_ } from "../apis/app";

export type FileProvider = (name: string) => Promise<ArrayBuffer>;
export const FS = new Dependency<FileProvider>('FileSystem');

export function UrlFs(path: string) {
  return (name: string) => loadBin(path + name)
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
    fileReader.onload = e => {
      loadJSZip;
      const JSZip = window['JSZip'];
      win.classList.add('hidden');
      const zip = JSZip.loadAsync(e.target.result);
      zip.then(zfs => {
        const files = Object.keys(zfs.files);
        const nameMap = new Map<string, any>();
        files.forEach(f => nameMap.set(f.toLowerCase(), zfs.file(f)));
        resolve((name: string) => nameMap.get(name.toLowerCase()).async('arraybuffer'))
      })
    }
  })
}

export async function LocalStorageProxy(injector: Injector) {
  const fsProvider = injector.getProvider(FS);
  injector.bindInstance(FS, async name => {
    const storage = await injector.getInstance(Storage_);
    const file = await storage.get(name);
    if (file) return file;
    const fs = await fsProvider(injector);
    const fsFile = await fs(name);
    storage.set(name, fsFile);
    return fsFile;
  });
}