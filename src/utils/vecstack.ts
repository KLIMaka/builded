import { vec2, Vec2Array, vec3, Vec3Array } from '../libs_js/glmatrix';
import { } from './mathutils';

export class VecStack3d {
  private stack: Vec3Array[] = [];
  private sp = 0;
  private sps = [];

  constructor(private size: number) {
    for (let i = 0; i < size; i++) this.stack.push(vec3.create());
  }

  start(): VecStack3d { this.sps.push(this.sp); return this }
  stop() { this.sp = this.sps.pop(); }
  return(id: number): number { this.stop(); return this.pushVec(this.stack[id]) }
  get(id: number): Vec3Array { return this.stack[id] }
  set(id: number, x: number, y: number, z: number) { vec3.set(this.stack[id], x, y, z) }
  copy(lh: number, rh: number): number { vec3.copy(this.stack[lh], this.stack[rh]); return lh }
  push(x: number, y: number, z: number): number { const id = this.allocate(); this.set(id, x, y, z); return id; }
  pushVec(vec: Vec3Array): number { const id = this.allocate(); vec3.copy(this.stack[id], vec); return id; }
  length(id: number): number { return vec3.len(this.stack[id]) }
  distance(lh: number, rh: number) { return vec3.dist(this.stack[lh], this.stack[rh]) }
  dot(lh: number, rh: number): number { return vec3.dot(this.stack[lh], this.stack[rh]) }
  allocate(): number { return this.sp++ }

  add(lh: number, rh: number): number {
    const result = this.allocate();
    vec3.add(this.stack[result], this.stack[lh], this.stack[rh]);
    return result;
  }

  sub(lh: number, rh: number): number {
    const result = this.allocate();
    vec3.sub(this.stack[result], this.stack[lh], this.stack[rh]);
    return result;
  }

  scale(id: number, scale: number): number {
    const result = this.allocate();
    vec3.scale(this.stack[result], this.stack[id], scale);
    return result;
  }

  normalized(id: number): number {
    const result = this.allocate();
    vec3.normalize(this.stack[result], this.stack[id]);
    return result;
  }
}

export class VecStack2d {
  private stack: Float32Array;
  private sp = 0;
  private sps = [];

  constructor(private size: number) {
    this.stack = new Float32Array(size * 2);
  }

  start(): VecStack2d { this.sps.push(this.sp); return this }
  stop() { this.sp = this.sps.pop(); }
  return(id: number): number { this.stop(); const nid = this.allocate(); this.stack[nid] = this.stack[id]; this.stack[nid + 1] = this.stack[id + 1]; return nid }
  get(id: number): number { return this.stack[id] }
  set(id: number, x: number, y: number) { this.stack[id] = x; this.stack[id + 1] = y }
  copy(lh: number, rh: number): number { this.stack[lh] = this.stack[rh]; this.stack[lh + 1] = this.stack[rh + 1]; return lh }
  push(x: number, y: number): number { const id = this.allocate(); this.set(id, x, y); return id; }
  length(id: number): number { return Math.hypot(this.stack[id], this.stack[id + 1]) }
  dot(lh: number, rh: number): number { return this.stack[lh] * this.stack[rh] + this.stack[lh + 1] * this.stack[rh + 1] }
  distance(lh: number, rh: number) { return Math.hypot(this.stack[lh] - this.stack[rh], this.stack[lh + 1] - this.stack[rh + 1]) }
  allocate(): number { return this.sp += 2 }


  add(lh: number, rh: number): number {
    const result = this.allocate();
    this.stack[result] = this.stack[lh] + this.stack[rh];
    this.stack[result + 1] = this.stack[lh + 1] + this.stack[rh + 1];
    return result;
  }

  sub(lh: number, rh: number): number {
    const result = this.allocate();
    this.stack[result] = this.stack[lh] - this.stack[rh];
    this.stack[result + 1] = this.stack[lh + 1] - this.stack[rh + 1];
    return result;
  }

  mul(lh: number, rh: number): number {
    const result = this.allocate();
    this.stack[result] = this.stack[lh] * this.stack[rh];
    this.stack[result + 1] = this.stack[lh + 1] * this.stack[rh + 1];
    return result;
  }

  scale(id: number, scale: number): number {
    const result = this.allocate();
    this.stack[result] = this.stack[id] * scale;
    this.stack[result + 1] = this.stack[id + 1] * scale;
    return result;
  }

  apply(id: number, f: (x: number) => number): number {
    return this.push(f(this.stack[id]), f(this.stack[id + 1]));
  }

  normalized(id: number): number {
    const len = Math.hypot(this.stack[id], this.stack[id + 1]);
    return this.scale(id, 1 / len);
  }
}