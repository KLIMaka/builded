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

export function sphere(vecs: VecStack3d, pos: number, center: number, r: number): number {
  return vecs.distance(pos, center) - r;
}

export function softShadow(penumbra: number, vecs: VecStack3d, pos: number, toLight: number, s: SdfShape): number {
  let shadow = 1.0;
  let ph = 1e20;
  let l = 0.01;
  let radius = l;
  for (let i = 0; i < 32; i++) {
    const d = s(vecs, vecs.start().add(pos, vecs.scale(toLight, l)));
    vecs.stop();
    // const y = d * d / (2.0 * ph);
    // const z = Math.sqrt(d * d - y * y);
    // shadow = Math.min(shadow, penumbra * z / Math.max(0.0, l - y));
    // shadow = Math.min(shadow, penumbra * d / l)
    // ph = d;
    // l += d;
    // if (d <= 0.0001) { shadow = 0.0; break }
    // if (l > 1) break;

    shadow = Math.min(shadow, penumbra * d / radius);
    radius += clamp(d, 0.02, 0.1);
    l += d;
    if (d <= 0.0001) { shadow = 0.0; break }
    if (l > 1) break;

  }
  const r = clamp(shadow, 0.0, 1.0);
  return r * r * (3.0 - 2.0 * r);
}

export function ambientOcclusion(vecs: VecStack3d, pos: number, normal: number, s: SdfShape): number {
  let occ = 0;
  let sca = 1;
  for (let i = 0; i < 5; i++) {
    const h = 0.001 + 0.15 * i / 4.0;
    const d = s(vecs, vecs.start().add(pos, vecs.scale(normal, h)))
    vecs.stop();
    occ += (h - d) * sca;
    sca *= 0.95;
  }
  return clamp(1 - 1.5 * occ, 0, 1);
}

export function lambert(vecs: VecStack3d, normal: number, toLight: number): number {
  return clamp(vecs.dot(normal, toLight), 0, 1)
}

const H = 0.0001;
export function normal(vecs: VecStack3d, pos: number, s: SdfShape): number {
  return vecs.start().return(vecs.normalized(
    vecs.push(
      s(vecs, vecs.add(pos, vecs.push(H, 0, 0))) - s(vecs, vecs.add(pos, vecs.push(-H, 0, 0))),
      s(vecs, vecs.add(pos, vecs.push(0, H, 0))) - s(vecs, vecs.add(pos, vecs.push(0, -H, 0))),
      s(vecs, vecs.add(pos, vecs.push(0, 0, H))) - s(vecs, vecs.add(pos, vecs.push(0, 0, -H))),
    )
  ));
}

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
