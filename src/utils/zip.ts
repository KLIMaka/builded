import * as loadJSZip from "../libs_js/jszip";
loadJSZip;

const JSZip = window['JSZip'];

export function loadZip(buffer: ArrayBuffer | string): Promise<ZipFs> {
  return JSZip.loadAsync(buffer);
}

export interface ZipFile {
  async(format: string): Promise<ArrayBuffer>;
}

export interface ZipFs {
  readonly files: { [index: string]: ZipFile };
  file(name: string): ZipFile;
}