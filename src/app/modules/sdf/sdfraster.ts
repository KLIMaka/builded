import { vec3 } from '../../../libs_js/glmatrix';
import { clamp, mix } from '../../../utils/mathutils';
import { Raster } from '../../../utils/pixelprovider';
import { VecStack3d } from '../../../utils/vecstack';

export type SdfShape = (vecs: VecStack3d, pos: number) => number;
export type DistanceOperation = (d1: number, d2: number) => number;

export function SdfReducer(op: DistanceOperation) {
  return (vecs: VecStack3d, pos: number, s1: SdfShape, s2: SdfShape) => {
    const d1 = s1(vecs, pos);
    const d2 = s2(vecs, pos);
    return op(d1, d2);
  }
}

export const union = SdfReducer(Math.min);
export const sub = SdfReducer((d1, d2) => Math.max(-d1, d2));
export const intersect = SdfReducer(Math.max);

export const sunion = (k: number) => SdfReducer((d1, d2) => {
  const h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0, 1);
  return mix(d2, d1, h) - k * h * (1 - h);
});

export const ssub = (k: number) => SdfReducer((d1, d2) => {
  const h = clamp(0.5 - 0.5 * (d2 + d1) / k, 0, 1);
  return mix(d2, -d1, h) + k * h * (1 - h);
});

export const sintersect = (k: number) => SdfReducer((d1, d2) => {
  const h = clamp(0.5 - 0.5 * (d2 - d1) / k, 0, 1);
  return mix(d2, d1, h) + k * h * (1 - h);
})

export type Sdf<T> = {
  dist: (vecs: VecStack3d, pos: number) => number;
  color: (vecs: VecStack3d, pos: number) => T;
}

class SdfRaster<P> implements Raster<P> {
  private pos: number;
  private dx: number;
  private dy: number;

  constructor(private vecs: VecStack3d, readonly width: number, readonly height: number, private sdf: Sdf<P>, private bg: P, private xoff = 0, private yoff = 0, private d = 1) {
    this.dx = 1 / (this.width * d);
    this.dy = 1 / (this.height * d);
    this.pos = this.vecs.pushVec(vec3.create());
  }

  pixel(x: number, y: number): P {
    this.vecs.set(this.pos, (x + this.xoff) * this.dx, (y + this.yoff) * this.dy, 0);
    const pos = this.vecs.get(this.pos);
    for (let i = 0; i < 100; i++) {
      if (pos[2] >= 1) break;
      const dist = this.sdf.dist(this.vecs, this.pos);
      if (dist <= 1e-4) return this.sdf.color(this.vecs, this.pos);
      pos[2] += dist;
    }
    return this.bg;
  }
}

export function sdf<T>(vecs: VecStack3d, w: number, h: number, sdf: Sdf<T>, bg: T, xoff = 0, yoff = 0, d = 1) {
  return new SdfRaster(vecs, w, h, sdf, bg, xoff, yoff, d);
}
