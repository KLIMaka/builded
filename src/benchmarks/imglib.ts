import { ImgLib } from "../libs_js/wasm_lib";
import { Iter } from "../utils/iter";
import { range, rect } from "../utils/collections";
import { rand } from "../utils/random";
import { rgb2xyz, xyz2lab, findLab, convertPal } from "../utils/color";


function benchmark(name: string, f: () => void, warmup = 1000, runs = 100) {
  for (let i = 0; i < warmup; i++) f();

  const start = performance.now();
  for (let i = 0; i < runs; i++) f();
  console.log(name + ': ' + (performance.now() - start))
}


const pal = new Uint8Array(256 * 3);
for (let i = 0; i < 256; i++) {
  pal[i * 3] = i;
  pal[i * 3 + 1] = i;
  pal[i * 3 + 2] = i;
}

const lib = ImgLib.init(pal, 256, 255);

const src = new Uint8Array(Iter.of(range(0, 1024 * 1024 * 4)).map(_ => rand(0, 255)));

benchmark('ImgLib', () => {
  const dst = new Uint8Array(1024 * 1024);
  lib.palettize(1024, 1024, src, dst);
});

const xyzpal = convertPal([...pal], rgb2xyz);
const labpal = convertPal(xyzpal, xyz2lab);
benchmark('ImgLib JS', () => {
  const w = 1024;
  const h = 1024;
  const dst = new Uint8Array(w * h);
  for (const [x, y] of rect(w, h)) {
    const idx = y * w + x;
    const r = src[idx * 4];
    const g = src[idx * 4 + 1];
    const b = src[idx * 4 + 2];
    const xyz = rgb2xyz(r, g, b);
    const lab = xyz2lab(xyz[0], xyz[1], xyz[2]);
    dst[idx] = findLab(labpal, lab[0], lab[1], lab[2])[0];
  }
});

