import { Raster } from '../../../utils/pixelprovider';
import { vec3, Vec3Array } from '../../../libs_js/glmatrix';
import { clamp, mix } from '../../../utils/mathutils';
import { VecStack3d } from '../../../utils/vecstack';


export type SdfShape = (vecs: VecStack3d, pos: number) => number;

export function union(vecs: VecStack3d, pos: number, s1: SdfShape, s2: SdfShape) { return Math.min(s1(vecs, pos), s2(vecs, pos)) }
export function sub(vecs: VecStack3d, pos: number, s1: SdfShape, s2: SdfShape) { return Math.max(-s1(vecs, pos), s2(vecs, pos)) }
export function intersect(vecs: VecStack3d, pos: number, s1: SdfShape, s2: SdfShape) { return Math.max(s1(vecs, pos), s2(vecs, pos)) }

export function sunion(vecs: VecStack3d, pos: number, s1: SdfShape, s2: SdfShape, k: number) {
  const d1 = s1(vecs, pos);
  const d2 = s2(vecs, pos);
  const h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0, 1);
  return mix(d2, d1, h) - k * h * (1 - h);
}

export function ssub(vecs: VecStack3d, pos: number, s1: SdfShape, s2: SdfShape, k: number) {
  const d1 = s1(vecs, pos);
  const d2 = s2(vecs, pos);
  const h = clamp(0.5 - 0.5 * (d2 + d1) / k, 0, 1);
  return mix(d2, -d1, h) + k * h * (1 - h);
}

export function sintersect(vecs: VecStack3d, pos: number, s1: SdfShape, s2: SdfShape, k: number) {
  const d1 = s1(vecs, pos);
  const d2 = s2(vecs, pos);
  const h = clamp(0.5 - 0.5 * (d2 - d1) / k, 0, 1);
  return mix(d2, d1, h) + k * h * (1 - h);
}



export type Sdf<T> = {
  dist: (vecs: VecStack3d, pos: number) => number;
  color: (vecs: VecStack3d, pos: number, normal: number) => T;
}

class SdfRaster<P> implements Raster<P> {
  private posId: number;
  private dx: number;
  private dy: number;
  private h = 0.00001;

  constructor(private vecs: VecStack3d, readonly width: number, readonly height: number, private sdf: Sdf<P>, private bg: P, private xoff = 0, private yoff = 0, private d = 1) {
    this.dx = 1 / (this.width * d);
    this.dy = 1 / (this.height * d);
    this.posId = this.vecs.pushVec(vec3.create());
  }

  pixel(x: number, y: number): P {
    this.vecs.set(this.posId, (x + this.xoff) * this.dx, (y + this.yoff) * this.dy, 0);
    const pos = this.vecs.get(this.posId);
    for (let i = 0; i < 100; i++) {
      if (pos[2] >= 1) break;
      const dist = this.getDist(this.posId);
      if (dist <= 1e-4) {
        this.vecs.start();
        const color = this.sdf.color(this.vecs, this.posId, this.normal());
        this.vecs.stop();
        return color;
      }
      pos[2] += dist;
    }
    return this.bg;
  }

  private getDist(pos: number): number {
    this.vecs.start();
    const dist = this.sdf.dist(this.vecs, pos);
    this.vecs.stop();
    return dist;
  }

  private normal(): number {
    const vecs = this.vecs;
    vecs.start();
    return vecs.return(vecs.normalized(
      vecs.push(
        this.getDist(vecs.add(this.posId, vecs.push(this.h, 0, 0))) - this.getDist(vecs.add(this.posId, vecs.push(-this.h, 0, 0))),
        this.getDist(vecs.add(this.posId, vecs.push(0, this.h, 0))) - this.getDist(vecs.add(this.posId, vecs.push(0, -this.h, 0))),
        this.getDist(vecs.add(this.posId, vecs.push(0, 0, this.h))) - this.getDist(vecs.add(this.posId, vecs.push(0, 0, -this.h))),
      )
    ));
  }
}

export function sdf<T>(vecs: VecStack3d, w: number, h: number, sdf: Sdf<T>, bg: T, xoff = 0, yoff = 0, d = 1) {
  return new SdfRaster(vecs, w, h, sdf, bg, xoff, yoff, d);
}
