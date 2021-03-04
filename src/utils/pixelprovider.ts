import { clamp, int } from './mathutils';

export interface Raster<P> {
  readonly width: number;
  readonly height: number;
  pixel(x: number, y: number): P;
}

export type Rasterizer<P> = (raster: Raster<P>, out: Uint8Array | Uint8ClampedArray | number[]) => void;

export function palRasterizer(pal: ArrayLike<number>): Rasterizer<number> {
  return (raster, out) => {
    const w = raster.width;
    const h = raster.height;
    let off = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const palIdx = raster.pixel(x, y) * 3;
        out[off + 0] = pal[palIdx + 0];
        out[off + 1] = pal[palIdx + 1];
        out[off + 2] = pal[palIdx + 2];
        out[off + 3] = 255;
        off += 4;
      }
    }
  }
}

export class ConstRaster<P> implements Raster<P> {
  constructor(readonly width: number, readonly height: number, private color: P) { }
  pixel(x: number, y: number) { return this.color };
}

export class ArrayRaster<P> implements Raster<P> {
  constructor(readonly width: number, readonly height: number, private pixels: ArrayLike<P>) { }
  pixel(x: number, y: number) { return this.pixels[y * this.width + x] };
}

export class TransformRaster<P, P1> implements Raster<P> {
  readonly width: number;
  readonly height: number;
  constructor(private src: Raster<P1>, private transform: (p: P1) => P) {
    this.width = src.width;
    this.height = src.height;
  }
  pixel(x: number, y: number) { return this.transform(this.src.pixel(x, y)) };
}

export class AxisSwapRaster<P> implements Raster<P> {
  readonly width: number;
  readonly height: number;
  constructor(private src: Raster<P>) {
    this.width = src.height;
    this.height = src.width;
  }
  pixel(x: number, y: number) { return this.src.pixel(y, x) };
}

export class RectRaster<P> implements Raster<P> {
  readonly width: number;
  readonly height: number;
  constructor(
    private src: Raster<P>,
    private sx: number,
    private sy: number,
    ex: number,
    ey: number,
    private padd: P,
  ) {
    this.width = ex - sx;
    this.height = ey - sy;
  }

  pixel(x: number, y: number): P {
    const nx = this.sx + x;
    const ny = this.sy + y;
    if (nx < 0 || ny < 0 || nx >= this.src.width || ny >= this.src.height) return this.padd;
    return this.src.pixel(nx, ny);
  }
}

export class ResizeRaster<P> implements Raster<P> {
  private readonly dx: number;
  private readonly dy: number;

  constructor(
    private src: Raster<P>,
    readonly width: number,
    readonly height: number
  ) {
    this.dx = src.width / this.width;
    this.dy = src.height / this.height;
  }

  pixel(x: number, y: number): P { return this.src.pixel(int(x * this.dx), int(y * this.dy)) }
}

export type PixelOperator<P> = (lh: P, rh: P) => P;
const DITH = [
  0.0, 0.5, 0.125, 0.625,
  0.75, 0.25, 0.875, 0.375,
  0.1875, 0.6875, 0.0625, 0.5625,
  0.9375, 0.4375, 0.8125, 0.3125
];
function dithOffset(x: number, y: number) {
  const idx = int(x) % 4 * 4 + int(y) % 4;
  return DITH[idx];
}

export class SuperResizeRaster<P> implements Raster<P> {
  private readonly dx: number;
  private readonly dy: number;
  private readonly maxw: number;
  private readonly maxh: number;

  constructor(
    private src: Raster<P>,
    readonly width: number,
    readonly height: number,
    private operator: PixelOperator<P>,
  ) {
    this.dx = src.width / this.width;
    this.dy = src.height / this.height;
    this.maxw = src.width - 1;
    this.maxh = src.height - 1;
  }

  pixel(x: number, y: number): P {
    const nx = x * this.dx + this.dx / 2;
    const ny = y * this.dy + this.dy / 2;
    const inx = int(nx);
    const iny = int(ny);
    const doff = dithOffset(x, y);
    if (doff < 0.5) return this.src.pixel(inx, iny);
    const fracx = nx - inx;
    const fracy = ny - iny;
    const dx = fracx <= 0.5 ? -1 : +1;
    const dy = fracy <= 0.5 ? -1 : +1;
    const addSample1 = this.src.pixel(clamp(inx + dx, 0, this.maxw), iny);
    const addSample2 = this.src.pixel(inx, clamp(iny + dy, 0, this.maxh));
    const newSample = this.operator(addSample1, addSample2);
    return newSample == null ? this.src.pixel(inx, iny) : newSample;
  }
}


export function array<P>(arr: ArrayLike<P>, w: number, h: number): Raster<P> {
  if (arr.length != w * h) throw new Error(`Invalid dimensions`);
  return new ArrayRaster(w, h, arr);
}

export function transform<P, P1>(src: Raster<P>, transform: (p: P) => P1): Raster<P1> {
  return new TransformRaster(src, transform);
}

export function axisSwap<P>(src: Raster<P>) {
  return new AxisSwapRaster(src);
}

export function rect<P>(src: Raster<P>, sx: number, sy: number, ex: number, ey: number, padd: P) {
  if (sx == 0 && sy == 0 && src.height == ey && src.width == ex) return src;
  return new RectRaster(src, sx, sy, ex, ey, padd);
}

export function center<P>(src: Raster<P>, w: number, h: number, padd: P) {
  const dw = int((src.width - w) / 2);
  const dh = int((src.height - h) / 2);
  return rect(src, dw, dh, w + dw, h + dh, padd);
}

export function resize<P>(src: Raster<P>, w: number, h: number) {
  if (src.height == h && src.width == w) return src;
  return new ResizeRaster(src, w, h);
}

export function superResize<P>(src: Raster<P>, w: number, h: number, op: PixelOperator<P>) {
  if (src.height == h && src.width == w) return src;
  return new SuperResizeRaster(src, w, h, op);
}

export function fit<P>(w: number, h: number, src: Raster<P>, padd: P) {
  if (src.height == h && src.width == w) return src;
  if (src.width <= w && src.height <= h) {
    const sx = int((src.width - w) / 2);
    const sy = int((src.height - h) / 2);
    return rect(src, sx, sy, w + sx, h + sy, padd);
  } else {
    const aspect = src.width / src.height;
    let nw = src.width;
    let nh = src.height;
    let r = false;
    if (nw > w) {
      nw = w;
      nh = int(nw / aspect);
      r = true;
    }
    if (nh > h) {
      nh = h;
      nw = int(nh * aspect);
      r = true;
    }
    if (r) {
      const sx = int((nw - w) / 2);
      const sy = int((nh - h) / 2);
      return rect(resize(src, nw, nh), sx, sy, w + sx, h + sy, padd);
    } else {
      return resize(src, w, h);
    }
  }
}
