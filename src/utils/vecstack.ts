import { vec2, Vec2Array, vec3, Vec3Array } from '../libs_js/glmatrix';
import { } from './mathutils';

export class VecStack3d {
  private stack: Vec3Array[] = [];
  private lastTop = 0;
  private currentTop = 0;
  private tops = [];

  constructor(private size: number) {
    for (let i = 0; i < size; i++) this.stack.push(vec3.create());
  }

  start(): VecStack3d { this.tops.push(this.currentTop); this.lastTop = this.currentTop; return this }
  stop() { this.currentTop = this.tops.pop(); this.lastTop = this.currentTop }
  return(id: number): number { this.stop(); return this.pushVec(this.stack[id]) }
  reset() { this.currentTop = this.lastTop }
  get(id: number): Vec3Array { return this.stack[id] }
  set(id: number, x: number, y: number, z: number) { vec3.set(this.stack[id], x, y, z) }
  copy(lh: number, rh: number): number { vec3.copy(this.stack[lh], this.stack[rh]); return lh }
  push(x: number, y: number, z: number): number { const id = this.allocate(); this.set(id, x, y, z); return id; }
  pushVec(vec: Vec3Array): number { const id = this.allocate(); vec3.copy(this.stack[id], vec); return id; }
  length(id: number): number { return vec3.len(this.stack[id]) }
  distance(lh: number, rh: number) { return vec3.dist(this.stack[lh], this.stack[rh]) }
  dot(lh: number, rh: number): number { return vec3.dot(this.stack[lh], this.stack[rh]) }
  allocate(): number { return this.currentTop++ }

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
  private lastTop = 0;
  private currentTop = 0;
  private tops = [];

  constructor(private size: number) {
    for (let i = 0; i < size; i++) this.stack.push(vec2.create());
  }

  start(): VecStack2d { this.tops.push(this.currentTop); this.lastTop = this.currentTop; return this }
  stop() { this.currentTop = this.tops.pop(); this.lastTop = this.currentTop }
  return(id: number): number { this.stop(); return this.pushVec(this.stack[id]) }
  reset() { this.currentTop = this.lastTop }
  get(id: number): Vec2Array { return this.stack[id] }
  set(id: number, x: number, y: number) { vec2.set(this.stack[id], x, y) }
  copy(lh: number, rh: number): number { vec2.copy(this.stack[lh], this.stack[rh]); return lh }
  push(x: number, y: number): number { const id = this.allocate(); this.set(id, x, y); return id; }
  pushVec(vec: Vec2Array): number { const id = this.allocate(); vec2.copy(this.stack[id], vec); return id; }
  length(id: number): number { return vec2.len(this.stack[id]) }
  distance(lh: number, rh: number) { return vec2.dist(this.stack[lh], this.stack[rh]) }
  dot(lh: number, rh: number): number { return vec2.dot(this.stack[lh], this.stack[rh]) }
  allocate(): number { return this.currentTop++ }

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

  scale(id: number, scale: number): number {
    const result = this.allocate();
    vec2.scale(this.stack[result], this.stack[id], scale);
    return result;
  }

  apply(id: number, f: (x: number) => number): number {
    return this.push(f(this.start[id][0]), f(this.start[id][1]));
  }

  normalized(id: number): number {
    const result = this.allocate();
    vec2.normalize(this.stack[result], this.stack[id]);
    return result;
  }
}