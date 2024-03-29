
export class VecStack {
  private stack: Float32Array;
  private sp = 0;
  private spStack = new Uint32Array(1024);
  private ssp = 0;
  private gp: number;

  readonly one: number;
  readonly zero: number;
  readonly half: number;


  constructor(size: number) {
    this.stack = new Float32Array(size * 4);
    this.gp = (size - 1) * 4;

    this.one = this.pushGlobal(1, 1, 1, 1);
    this.zero = this.pushGlobal(0, 0, 0, 0);
    this.half = this.pushGlobal(0.5, 0.5, 0.5, 0.5);
  }

  allocate(): number { const id = this.sp; this.sp += 4; return id }
  allocateGlobal(): number { const id = this.gp; this.gp -= 4; return id }
  call<Args extends any[]>(f: (stack: VecStack, ...args: Args) => number, ...args: Args) { this.begin(); return this.return(f(this, ...args)); }
  callScalar<Args extends any[]>(f: (stack: VecStack, ...args: Args) => number, ...args: Args) { this.begin(); return this.x(this.return(f(this, ...args))); }
  begin(): VecStack { this.spStack[this.ssp++] = this.sp; return this }
  end() { this.sp = this.spStack[--this.ssp] }
  return(id: number): number { this.end(); return this.copy(this.allocate(), id) }
  push(x: number, y: number, z: number, w: number): number { return this.set(this.allocate(), x, y, z, w); }
  pushScalar(x: number): number { return this.set(this.allocate(), x, 0, 0, 0); }
  pushSpread(x: number): number { return this.spread(this.allocate(), x); }
  spread(v: number, x: number): number { return this.set(v, x, x, x, x) }
  pushGlobal(x: number, y: number, z: number, w: number) { return this.set(this.allocateGlobal(), x, y, z, w); }
  length(id: number): number { return Math.hypot(this.stack[id], this.stack[id + 1], this.stack[id + 2], this.stack[id + 3]) }
  reflect(toPoint: number, normal: number) { return this.sub(toPoint, this.scale(normal, this.dot(toPoint, normal) * 2)) }
  sqrlength(id: number): number { return this.dot(id, id) }
  dot(lh: number, rh: number): number { return this.stack[lh] * this.stack[rh] + this.stack[lh + 1] * this.stack[rh + 1] + this.stack[lh + 2] * this.stack[rh + 2] + this.stack[lh + 3] * this.stack[rh + 3] }
  distance(lh: number, rh: number) { return Math.hypot(this.stack[lh] - this.stack[rh], this.stack[lh + 1] - this.stack[rh + 1], this.stack[lh + 2] - this.stack[rh + 2], this.stack[lh + 3] - this.stack[rh + 3]) }
  sqrdistance(lh: number, rh: number) { return this.sqrlength(this.sub(lh, rh)) }
  normalize(id: number): number { return this.scale(id, 1 / this.length(id)) }
  eqz(id: number) { return this.stack[id] == 0 && this.stack[id + 1] == 0 && this.stack[id + 2] == 0 && this.stack[id + 3] == 0 }

  x(ptr: number) { return this.stack[ptr] }
  y(ptr: number) { return this.stack[ptr + 1] }
  z(ptr: number) { return this.stack[ptr + 2] }
  w(ptr: number) { return this.stack[ptr + 3] }
  setx(ptr: number, v: number): VecStack { this.stack[ptr] = v; return this }
  sety(ptr: number, v: number): VecStack { this.stack[ptr + 1] = v; return this }
  setz(ptr: number, v: number): VecStack { this.stack[ptr + 2] = v; return this }
  setw(ptr: number, v: number): VecStack { this.stack[ptr + 3] = v; return this }

  copy(lh: number, rh: number): number {
    this.stack[lh] = this.stack[rh];
    this.stack[lh + 1] = this.stack[rh + 1];
    this.stack[lh + 2] = this.stack[rh + 2];
    this.stack[lh + 3] = this.stack[rh + 3];
    return lh;
  }

  set(id: number, x: number, y: number, z: number, w: number): number {
    this.stack[id] = x;
    this.stack[id + 1] = y;
    this.stack[id + 2] = z;
    this.stack[id + 3] = w;
    return id;
  }

  add(lh: number, rh: number): number {
    const result = this.allocate();
    this.stack[result] = this.stack[lh] + this.stack[rh];
    this.stack[result + 1] = this.stack[lh + 1] + this.stack[rh + 1];
    this.stack[result + 2] = this.stack[lh + 2] + this.stack[rh + 2];
    this.stack[result + 3] = this.stack[lh + 3] + this.stack[rh + 3];
    return result;
  }

  sub(lh: number, rh: number): number {
    const result = this.allocate();
    this.stack[result] = this.stack[lh] - this.stack[rh];
    this.stack[result + 1] = this.stack[lh + 1] - this.stack[rh + 1];
    this.stack[result + 2] = this.stack[lh + 2] - this.stack[rh + 2];
    this.stack[result + 3] = this.stack[lh + 3] - this.stack[rh + 3];
    return result;
  }

  mul(lh: number, rh: number): number {
    const result = this.allocate();
    this.stack[result] = this.stack[lh] * this.stack[rh];
    this.stack[result + 1] = this.stack[lh + 1] * this.stack[rh + 1];
    this.stack[result + 2] = this.stack[lh + 2] * this.stack[rh + 2];
    this.stack[result + 3] = this.stack[lh + 3] * this.stack[rh + 3];
    return result;
  }

  div(lh: number, rh: number): number {
    const result = this.allocate();
    this.stack[result] = this.stack[lh] / this.stack[rh];
    this.stack[result + 1] = this.stack[lh + 1] / this.stack[rh + 1];
    this.stack[result + 2] = this.stack[lh + 2] / this.stack[rh + 2];
    this.stack[result + 3] = this.stack[lh + 3] / this.stack[rh + 3];
    return result;
  }

  scale(id: number, scale: number): number {
    const result = this.allocate();
    this.stack[result] = this.stack[id] * scale;
    this.stack[result + 1] = this.stack[id + 1] * scale;
    this.stack[result + 2] = this.stack[id + 2] * scale;
    this.stack[result + 3] = this.stack[id + 3] * scale;
    return result;
  }

  lerp(lh: number, rh: number, t: number): number {
    const result = this.allocate();
    const t1 = 1 - t;
    this.stack[result] = this.stack[rh] * t + this.stack[lh] * t1;
    this.stack[result + 1] = this.stack[rh + 1] * t + this.stack[lh + 1] * t1;
    this.stack[result + 2] = this.stack[rh + 2] * t + this.stack[lh + 2] * t1;
    this.stack[result + 3] = this.stack[rh + 3] * t + this.stack[lh + 3] * t1;
    return result;
  }

  apply(id: number, f: (x: number) => number): number {
    return this.push(
      f(this.stack[id]),
      f(this.stack[id + 1]),
      f(this.stack[id + 2]),
      f(this.stack[id + 3])
    );
  }

  apply2(lh: number, rh: number, f: (x: number, y: number) => number): number {
    return this.push(
      f(this.stack[lh], this.stack[rh]),
      f(this.stack[lh + 1], this.stack[rh + 1]),
      f(this.stack[lh + 2], this.stack[rh + 2]),
      f(this.stack[lh + 3], this.stack[rh + 3])
    );
  }
}