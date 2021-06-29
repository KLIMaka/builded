import { Dependency, Injector, provider } from '../../../utils/injector';
import { loadWasm } from '../../../utils/wasm/wasm';

export interface VecStack {
  begin(): void;
  end(): void;
  rtn(): number;
  allocate(): number;
  allocateGloabal(): number;
  push(x: number, y: number, z: number, w: number): number;
  pushGlobal(x: number, y: number, z: number, w: number): number;
  set(ptr: number, x: number, y: number, z: number, w: number): number;
  copy(dst: number, src: number): number;

  x(ptr: number): number;
  y(ptr: number): number;
  z(ptr: number): number;
  w(ptr: number): number;

  add(lh: number, rh: number): number;
  sub(lh: number, rh: number): number;
  mul(lh: number, rh: number): number;
  div(lh: number, rh: number): number;
  dot(lh: number, rh: number): number;
  distance(lh: number, rh: number): number;
  scale(ptr: number, s: number): number;
  normalize(ptr: number): number;
  length(ptr: number): number;

  call<Args extends number[]>(f: (stack: VecStack, ...args: Args) => number, ...args: Args): number;
  apply(ptr: number, f: (x: number) => number): number;
  apply2(lh: number, rh: number, f: (x: number, y: number) => number): number;
}

export const VEC_STACK = new Dependency<VecStack>('VecStack');

export const DefaultVecStack = provider<VecStack>(async (injector: Injector) => {
  const wasm = await loadWasm('./resources/test.wasm');
  return <VecStack>{
    begin: wasm.begin,
    end: wasm.end,
    rtn: wasm.rtn,
    allocate: wasm.allocate,
    allocateGloabal: wasm.allocateGloabal,
    push: wasm.push,
    pushGlobal: wasm.pushGlobal,
    set: wasm.set,
    copy: wasm.copy,
    x: wasm.x,
    y: wasm.y,
    z: wasm.z,
    w: wasm.w,
    add: wasm.add,
    sub: wasm.sub,
    mul: wasm.mul,
    div: wasm.div,
    dot: wasm.dot,
    distance: wasm.distance,
    scale: wasm.scale,
    normalize: wasm.normalize,
    length: wasm.length,

    call<Args extends number[]>(f: (stack: VecStack, ...args: Args) => number, ...args: Args) { this.begin(); return this.rtn(f(this, ...args)); },
    apply(ptr: number, f: (x: number) => number): number { return this.push(f(this.x(ptr)), f(this.y(ptr)), f(this.z(ptr)), f(this.w(ptr))) },
    apply2(lh: number, rh: number, f: (x: number, y: number) => number): number { return this.push(f(this.x(lh), this.x(rh)), f(this.y(lh), this.y(rh)), f(this.z(lh), this.z(rh)), f(this.w(lh), this.w(rh))) }
  }
});