import { JSZip, ZipFs } from "../libs_js/jszip";

export function loadZip(buffer: ArrayBuffer | string): Promise<ZipFs> {
  return JSZip.loadAsync(buffer);
}
