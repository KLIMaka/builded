import { rect } from "./collections";
import { int } from "./mathutils";

export function rgb2hsl(r: number, g: number, b: number): [number, number, number] {
  // convert RGB to HSV
  const rd = r / 255.0;            // rd,gd,bd range 0-1 instead of 0-255
  const gd = g / 255.0;
  const bd = b / 255.0;

  const max = Math.max(rd, gd, bd);
  const min = Math.min(rd, gd, bd);
  const l = (max + min) / 2.0;
  const delta = max - min;
  let s = 0;
  let h = 0;
  if (max != min) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max == rd) h = 42.5 * (gd - bd) / (delta);
    else if (max == gd) h = 42.5 * ((bd - rd) / (delta) + 2);
    else h = 42.5 * ((rd - gd) / (delta) + 4);
    if (h < 0) h += 255;
  }
  return [h | 0, (s * 255) | 0, (l * 255) | 0];
}

export function hsl2rgb(h: number, s: number, l: number): [number, number, number] {
  if (s == 0) return [l, l, l];

  // const hf = h / 255.0;
  const lf = l / 255.0;
  const sf = s / 255.0;

  const c = (1 - Math.abs(2 * lf - 1)) * sf;
  const x = c * (1 - Math.abs((h / 42.5) % 2 - 1));
  const m = lf - c / 2;

  let r = 0, g = 0, b = 0;
  if (h >= 0 && h < 42.5) { r = c; g = x; b = 0; }
  else if (h >= 42.5 && h <= 42.5 * 2) { r = x; g = c; b = 0; }
  else if (h >= 42.5 * 2 && h <= 42.5 * 3) { r = 0; g = c; b = x; }
  else if (h >= 42.5 * 3 && h <= 42.5 * 4) { r = 0; g = x; b = c; }
  else if (h >= 42.5 * 4 && h <= 42.5 * 5) { r = x; g = 0; b = c; }
  else if (h >= 42.5 * 5 && h <= 42.5 * 6) { r = c; g = 0; b = x; }

  return [((r + m) * 255) | 0, ((g + m) * 255) | 0, ((b + m) * 255) | 0];
}

export function rgb2xyz(r: number, g: number, b: number): [number, number, number] {
  return [
    (r * 0.49 + g * 0.31 + b * 0.2) / 0.17697,
    (r * 0.17697 + g * 0.8124 + b * 0.01063) / 0.17697,
    (r * 0 + g * 0.01 + b * 0.99) / 0.17697
  ];
}

export function xyz2rgb(x: number, y: number, z: number): [number, number, number] {
  return [
    x * 0.41847 + y * -0.15866 + z * -0.082835,
    x * -0.091169 + y * 0.25243 + z * 0.015708,
    x * 0.00092090 + y * -0.0025498 + z * 0.1786
  ];
}

const xn = 95.047;
const yn = 100;
const zn = 108.883;
const c = Math.pow(6 / 29, 3);
function f(t: number): number {
  if (t > c) return Math.pow(t, 1 / 3);
  else return (1 / 3) * Math.pow(29 / 6, 2) * t + 4 / 29;
}

export function xyz2lab(x: number, y: number, z: number): [number, number, number] {
  return [
    116 * f(y / yn) - 16,
    500 * (f(x / xn) - f(y / yn)),
    200 * (f(y / yn) - f(z / zn))
  ]
}

export function convertPal(srcPal: number[], conv: (a: number, b: number, c: number) => [number, number, number]): number[] {
  const dst = new Array<number>(256 * 3);
  for (let i = 0; i < 256; i++) {
    const off = i * 3;
    const r = conv(srcPal[off + 0], srcPal[off + 1], srcPal[off + 2]);
    dst[off + 0] = r[0];
    dst[off + 1] = r[1];
    dst[off + 2] = r[2];
  }
  return dst;
}

export function labDist(pal: number[], color: number, l: number, a: number, b: number) {
  const off = color * 3;
  const dh = l - pal[off + 0];
  const ds = a - pal[off + 1];
  const dl = b - pal[off + 2];
  return Math.sqrt(dh * dh + ds * ds + dl * dl);
}

export function findLab(pal: number[], l: number, a: number, b: number): [number, number, number] {
  let mindist = Number.MAX_VALUE;
  let mindist1 = Number.MAX_VALUE;
  let idx = 0;
  let idx1 = 0;
  for (let i = 0; i < 256; i++) {
    const off = i * 3;
    const dh = l - pal[off + 0];
    const ds = a - pal[off + 1];
    const dl = b - pal[off + 2];
    const dist = Math.sqrt(dh * dh + ds * ds + dl * dl);
    if (dist < mindist) {
      mindist1 = mindist;
      idx1 = idx;
      mindist = dist;
      idx = i;
    }
  }
  return [idx, idx1, mindist / mindist1];
}

export function resizeIndexed(dstw: number, dsth: number, srcw: number, srch: number, src: Uint8Array, pal: number[], labpal: number[]): Uint8Array {
  const dst = new Uint8Array(dstw * dsth);
  const dx = srcw / dstw;
  const dy = srch / dsth;
  for (const [x, y] of rect(dstw, dsth))
    dst[y * dstw + x] = convoluteIndexed(x * dx, y * dy, dx, dy, srcw, src, pal, labpal);
  return dst;
}

export function convoluteIndexed(x: number, y: number, w: number, h: number, imgw: number, img: Uint8Array, pal: number[], labpal: number[]): number {
  if (w == int(w) && h == int(h) && x == int(x) && y == int(y)) {
    const sum = [0, 0, 0];
    let trans = 0;
    const colors = new Set<number>();
    for (const [xx, yy] of rect(w, h)) {
      const off = (yy + y) * imgw + xx + x;
      const color = img[off] * 3;
      if (color == 255 * 3) {
        trans++;
        if (trans > (w * h) / 2) return 255;
      } else {
        sum[0] += pal[color + 0];
        sum[1] += pal[color + 1];
        sum[2] += pal[color + 2];
        colors.add(color / 3);
      }
    }
    const weight = 1 / (w * h - trans);
    const xyz = rgb2xyz(sum[0] * weight, sum[1] * weight, sum[2] * weight);
    const lab = xyz2lab(xyz[0], xyz[1], xyz[2]);
    let mindist = Number.MAX_VALUE;
    let mindist1 = Number.MAX_VALUE;
    let idx = 0;
    let idx1 = 0;
    for (const color of colors) {
      const dist = labDist(labpal, color, lab[0], lab[1], lab[2]);
      if (mindist > dist) {
        idx1 = idx;
        mindist1 = mindist;
        idx = color;
        mindist = dist;
      }
    }

    const [i, i1, t] = findLab(labpal, lab[0], lab[1], lab[2]);
    const d = labDist(labpal, i, lab[0], lab[1], lab[2]);
    // return dither(x, y, t, ditherMatrix) ? i : i1;
    return d / mindist < 0.2 ? i : dither(x, y, mindist / mindist1, ditherMatrix) ? idx : idx1;
  } else {
    return img[int(y + h / 2) * imgw + int(x + w / 2)];
  }
}

function scale3resample(x: number, y: number, w: number, h: number, src: Uint8Array): number {
  const px = Math.min(x + 1, w - 1);
  const mx = Math.max(x - 1, 0);
  const py = Math.min(y + 1, h - 1);
  const my = Math.max(y - 1, 0);

  return 0;
}

export const ditherMatrix = [
  0, 32, 8, 40, 2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37,
  63, 31, 55, 23, 61, 29, 53, 21];

export function dither(x: number, y: number, t: number, matrix: number[]): boolean {
  const size = matrix.length;
  const rsize = 1 / size;
  if (t < (0.0 + rsize / 2)) return true;
  if (t > (1.0 - rsize / 2)) return false;
  const sqrsize = Math.sqrt(size);
  const idx = (y % sqrsize) * sqrsize + (x % sqrsize);
  const d = matrix[idx] / (size - 1);
  return t <= d;
}

export function rgb2lum(r: number, g: number, b: number): number {
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

export function scale2x(w: number, h: number, src: Uint8Array): Uint8Array {
  const dst = new Uint8Array(4 * w * h);
  for (const [x, y] of rect(w, h)) {
    const px = Math.min(x + 1, w - 1);
    const mx = Math.max(x - 1, 0);
    const py = Math.min(y + 1, h - 1);
    const my = Math.max(y - 1, 0);
    const b = src[my * w + x];
    const d = src[y * w + mx];
    const e = src[y * w + x];
    const f = src[y * w + px];
    const h1 = src[py * w + x];
    if (b != h1 && d != f) {
      dst[y * w * 4 + x * 2] = d == b ? d : e;
      dst[y * w * 4 + x * 2 + 1] = b == f ? f : e;
      dst[(y * 2 + 1) * w * 2 + x * 2] = d == h1 ? d : e;
      dst[(y * 2 + 1) * w * 2 + x * 2 + 1] = h1 == f ? f : e;
    } else {
      dst[y * w * 4 + x * 2] =
        dst[y * w * 4 + x * 2 + 1] =
        dst[(y * 2 + 1) * w * 2 + x * 2] =
        dst[(y * 2 + 1) * w * 2 + x * 2 + 1] = e;
    }
  }
  return dst;
}
