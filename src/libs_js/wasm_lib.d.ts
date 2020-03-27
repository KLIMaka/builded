/* tslint:disable */
/* eslint-disable */
/**
*/
export class ImgLib {
  free(): void;
/**
* @param {Uint8Array} pal 
* @param {number} palsize 
* @param {number} trans_idx 
* @returns {ImgLib} 
*/
  static init(pal: Uint8Array, palsize: number, trans_idx: number): ImgLib;
/**
* @param {number} dstw 
* @param {number} dsth 
* @param {Uint8Array} dst 
* @param {number} srcw 
* @param {number} srch 
* @param {Uint8Array} src 
*/
  resize(dstw: number, dsth: number, dst: Uint8Array, srcw: number, srch: number, src: Uint8Array): void;
/**
* @param {number} w 
* @param {number} h 
* @param {Uint8Array} img 
* @param {Uint8Array} dst 
*/
  palettize(w: number, h: number, img: Uint8Array, dst: Uint8Array): void;
}

/**
* If `module_or_path` is {RequestInfo}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {RequestInfo | BufferSource | WebAssembly.Module} module_or_path
*
* @returns {Promise<any>}
*/
export default function init (module_or_path?: RequestInfo | BufferSource | WebAssembly.Module): Promise<any>;
        