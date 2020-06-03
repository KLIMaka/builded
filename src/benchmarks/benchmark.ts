import { RAW_PAL } from "../app/modules/artselector";
import { range } from "../utils/collections";
import { IndexedImgLibJsConstructor, IndexedImgLibWasmConstructor, INDEXED_IMG_LIB } from "../utils/imglib";
import { Injector } from "../utils/injector";
import { Iter } from "../utils/iter";
import { rand } from "../utils/random";
import { greet } from "buildlib-wasm";


function benchmark(name: string, f: () => void, warmup = 100, runs = 100) {
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

const W = 128;
const H = 128;
const src = new Uint8Array(Iter.of(range(0, W * H * 4)).map(_ => rand(0, 255)));

const injector = new Injector();
injector.bind(INDEXED_IMG_LIB, IndexedImgLibJsConstructor);
injector.bindInstance(RAW_PAL, pal);

injector.getInstance(INDEXED_IMG_LIB).then(lib => {
  benchmark('IndexedImgLibJs', () => {
    lib.palettize(W, H, src);
  })
});

const injector1 = new Injector();
injector1.bind(INDEXED_IMG_LIB, IndexedImgLibWasmConstructor);
injector1.bindInstance(RAW_PAL, pal);

injector1.getInstance(INDEXED_IMG_LIB).then(lib => {
  benchmark('IndexedImgLibWasm', () => {
    lib.palettize(W, H, src);
  })
});

greet();
