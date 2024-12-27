import { Dependency, Injector, provider } from "./injector";
import { RAW_PAL } from "../app/modules/artselector";
// import init, { ImgLib } from "../libs_js/wasm_lib";
import { convertPal, rgb2xyz, xyz2lab, resizeIndexed, findLab } from "./color";
import { rect } from "./collections";

export interface IndexedImgLib {
  palettize(w: number, h: number, img: Uint8Array): Uint8Array;
  resize(dstw: number, dsth: number, srcw: number, srch: number, src: Uint8Array): Uint8Array;
}

export const INDEXED_IMG_LIB = new Dependency<IndexedImgLib>('IndexedImgLib');

// export async function IndexedImgLibWasmConstructor(injector: Injector): Promise<IndexedImgLib> {
//   const pal = await injector.getInstance(RAW_PAL);
//   await init();
//   let lib = ImgLib.init(pal, 256, 255);
//   return {
//     palettize: (w: number, h: number, img: Uint8Array) => {
//       const dst = new Uint8Array(w * h);
//       lib.palettize(w, h, img, dst);
//       return dst;
//     },
//     resize: (dstw: number, dsth: number, srcw: number, srch: number, src: Uint8Array) => {
//       const dst = new Uint8Array(dstw * dsth);
//       lib.resize(dstw, dsth, dst, srcw, srch, src);
//       return dst;
//     }
//   }
// }

export const IndexedImgLibJsConstructor = provider(async (injector: Injector) => {
  const pal = [...await injector.getInstance(RAW_PAL)];
  const xyzpal = convertPal(pal, rgb2xyz);
  const labpal = convertPal(xyzpal, xyz2lab);
  return {
    palettize: (w: number, h: number, img: Uint8Array) => {
      const dst = new Uint8Array(w * h);
      for (const [xc, yc] of rect(w, h)) {
        const idx = yc * w + xc;
        const r_ = img[idx * 4];
        const g_ = img[idx * 4 + 1];
        const b_ = img[idx * 4 + 2];
        const [x, y, z] = rgb2xyz(r_, g_, b_);
        const [l, a, b] = xyz2lab(x, y, z);
        dst[idx] = findLab(labpal, l, a, b)[0];
      }
      return dst;
    },
    resize: (dstw: number, dsth: number, srcw: number, srch: number, src: Uint8Array) => {
      return resizeIndexed(dstw, dsth, srcw, srch, src, pal, labpal);
    }
  }
});