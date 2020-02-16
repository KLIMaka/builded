import * as loadJSZip from "../../libs_js/jszip";

function drag(e) {
  e.stopPropagation();
  e.preventDefault();
}

export function ZipFs() {
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
      zip.then(zfs => resolve((name: string) => zfs.file(name).async('arraybuffer')))
    }
  })
}