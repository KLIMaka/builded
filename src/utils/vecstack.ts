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
  private stack: Vec2Array[] = [];
  private sp = 0;
  private sps = [];

  constructor(private size: number) {
    for (let i = 0; i < size; i++) this.stack.push(vec2.create());
  }

  start(): VecStack2d { this.sps.push(this.sp); return this }
  stop() { this.sp = this.sps.pop(); }
  return(id: number): number { this.stop(); return this.pushVec(this.stack[id]) }
  get(id: number): Vec2Array { return this.stack[id] }
  set(id: number, x: number, y: number) { vec2.set(this.stack[id], x, y) }
  copy(lh: number, rh: number): number { vec2.copy(this.stack[lh], this.stack[rh]); return lh }
  push(x: number, y: number): number { const id = this.allocate(); this.set(id, x, y); return id; }
  pushVec(vec: Vec2Array): number { const id = this.allocate(); vec2.copy(this.stack[id], vec); return id; }
  length(id: number): number { return vec2.len(this.stack[id]) }
  distance(lh: number, rh: number) { return vec2.dist(this.stack[lh], this.stack[rh]) }
  dot(lh: number, rh: number): number { return vec2.dot(this.stack[lh], this.stack[rh]) }
  allocate(): number { return this.sp++ }

  add(lh: number, rh: number): number {
    const result = this.allocate();
    vec2.add(this.stack[result], this.stack[lh], this.stack[rh]);
    return result;
  }

  sub(lh: number, rh: number): number {
    const result = this.allocate();
    vec2.sub(this.stack[result], this.stack[lh], this.stack[rh]);
    return result;
  }

  mul(lh: number, rh: number): number {
    const result = this.allocate();
    vec2.mul(this.stack[result], this.stack[lh], this.stack[rh]);
    return result;
  }

  scale(id: number, scale: number): number {
    const result = this.allocate();
    vec2.scale(this.stack[result], this.stack[id], scale);
    return result;
  }

  apply(id: number, f: (x: number) => number): number {
    return this.push(f(this.stack[id][0]), f(this.stack[id][1]));
  }

  normalized(id: number): number {
    const result = this.allocate();
    vec2.normalize(this.stack[result], this.stack[id]);
    return result;
  }
}