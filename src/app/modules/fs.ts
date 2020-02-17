import * as loadJSZip from "../../libs_js/jszip";
import { Dependency } from "../../utils/injector";
import { loadBin } from "../../utils/getter";


export type FileProvider = (name: string) => Promise<ArrayBuffer>;
export const FS_ = new Dependency<FileProvider>('FileSystem');

export async function UrlFs(path: string) {
  return (name: string) => loadBin(path + name)
}

function drag(e) {
  e.stopPropagation();
  e.preventDefault();
}

export function ZipFs(): Promise<FileProvider> {
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