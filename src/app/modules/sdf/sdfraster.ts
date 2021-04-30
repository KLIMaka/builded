import { Raster } from '../../../utils/pixelprovider';
import { vec3, Vec3Array } from '../../../libs_js/glmatrix';

export type Sdf<T> = {
  dist: (pos: Vec3Array) => number;
  color: (pos: Vec3Array, normal: Vec3Array) => T;
}

class SdfRaster<P> implements Raster<P> {
  private _normal = vec3.create();
  private _pos = vec3.create();
  private dx: number;
  private dy: number;
  private h = 0.00001;
  private hh = this.h * 2;

  constructor(readonly width: number, readonly height: number, private sdf: Sdf<P>, private bg: P) {
    this.dx = 1 / this.width;
    this.dy = 1 / this.height;
  }

  pixel(x: number, y: number): P {
    vec3.set(this._pos, x * this.dx, y * this.dy, 0);
    const pos = this._pos;
    for (let i = 0; i < 100; i++) {
      if (pos[2] > 2) break;
      const dist = this.sdf.dist(pos);
      if (dist <= 1e-4) return this.sdf.color(pos, this.normal());
      pos[2] += dist;
    }
    return this.bg;
  }

  private normal(): Vec3Array {
    const pos = this._pos;
    pos[0] += this.h;
    const d1 = this.sdf.dist(pos);
    pos[0] -= this.hh;
    const d2 = this.sdf.dist(pos);
    pos[0] += this.h;

    pos[1] += this.h;
    const d3 = this.sdf.dist(pos);
    pos[1] -= this.hh;
    const d4 = this.sdf.dist(pos);
    pos[1] += this.h;

    pos[2] += this.h;
    const d5 = this.sdf.dist(pos);
    pos[2] -= this.hh;
    const d6 = this.sdf.dist(pos);
    pos[2] += this.h;

    return vec3.normalize(this._normal, vec3.fromValues(d1 - d2, d3 - d4, d5 - d6));
  }
}

export function sdf<T>(w: number, h: number, sdf: Sdf<T>, bg: T) {
  return new SdfRaster(w, h, sdf, bg);
}
