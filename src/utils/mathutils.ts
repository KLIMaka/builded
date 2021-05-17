import { Interpolator } from "./interpolator";

export const radsInDeg = 180 / Math.PI;
export const degInRad = Math.PI / 180;
export const PI2 = Math.PI * 2;
export const EPS = 1e-9;

export function eq(lh: number, rh: number) {
  return Math.abs(lh - rh) < EPS;
}

export function lse(lh: number, rh: number) {
  return eq(lh, rh) || lh < rh;
}
export function gte(lh: number, rh: number) {
  return eq(lh, rh) || lh > rh;
}

export function deg2rad(deg: number): number {
  return deg * degInRad;
}

export function rad2deg(rad: number): number {
  return rad * radsInDeg;
}

export function sign(x: number) {
  return x > 0 ? 1 : x < 0 ? -1 : 0;
}

export function int(x: number) {
  return x | 0;
}

export function clamp(x: number, min: number, max: number) {
  return x > max ? max : x < min ? min : x;
}

export function mix(x: number, y: number, d: number) {
  return x + (y - x) * d;
}

export function trz(x: number) {
  x = int(x);
  if (x == 0) return 32;
  let count = 0;
  while ((x & 1) == 0) {
    x = x >> 1;
    count++;
  }
  return count;
}

export function ispow2(x: number): boolean {
  return (x & (x - 1)) == 0;
}

export function fract(x: number): number {
  return x - int(x);
}

export function nextpow2(x: number) {
  --x;
  for (var i = 1; i < 32; i <<= 1) {
    x = x | x >> i;
  }
  return x + 1;
}

export function sqrLen2d(x: number, y: number) {
  return x * x + y * y;
}

export function len2d(x: number, y: number) {
  return Math.sqrt(x * x + y * y);
}

export function lenPointToLine(px: number, py: number, l1x: number, l1y: number, l2x: number, l2y: number) {
  const ldx = l2x - l1x;
  const ldy = l2y - l1y;
  const pdx = px - l1x;
  const pdy = py - l1y;
  const dot = dot2d(ldx, ldy, pdx, pdy);
  if (dot <= 0) return len2d(pdx, pdy);
  const llensqr = sqrLen2d(ldx, ldy);
  if (dot >= llensqr) return len2d(px - l2x, py - l2y);
  const t = dot / llensqr;
  return len2d(px - (l1x + ldx * t), py - (l1y + ldy * t));
}

export function len3d(x: number, y: number, z: number) {
  return Math.sqrt(x * x + y * y + z * z);
}

export function dot2d(x1: number, y1: number, x2: number, y2: number) {
  return x1 * x2 + y1 * y2;
}

export function cross2d(x1: number, y1: number, x2: number, y2: number) {
  return x1 * y2 - y1 * x2;
}

export function monoatan2(y: number, x: number): number {
  let atan = Math.atan2(y, x);
  return atan < 0 ? (2 * Math.PI) + atan : atan;
}

export function angInArc(arcStart: number, arcEnd: number, ang: number): boolean {
  return arcStart > arcEnd ? ang >= arcStart || ang <= arcEnd : ang >= arcStart && ang <= arcEnd;
}

export function arcsIntersects(a1s: number, a1e: number, a2s: number, a2e: number): boolean {
  return angInArc(a1s, a1e, a2s) || angInArc(a1s, a1e, a2e) || angInArc(a2s, a2e, a1s) || angInArc(a2s, a2e, a1e);
}

export function cyclic(x: number, max: number): number {
  const mod = x % max;
  return x >= 0 ? mod : mod == 0 ? max - 1 : max + mod;
}

export function ubyte2byte(n: number) {
  var minus = (n & 0x80) != 0;
  return minus ? -(~n & 0xFF) - 1 : n;
}

export function int2vec4(int: number) {
  return [(int & 0xff), ((int >>> 8) & 0xff), ((int >>> 16) & 0xff), ((int >>> 24) & 0xff)];
}

export function int2vec4norm(int: number) {
  return [(int & 0xff) / 256, ((int >>> 8) & 0xff) / 256, ((int >>> 16) & 0xff) / 256, ((int >>> 24) & 0xff) / 256];
}

export function tuple(v0: number, v1: number) {
  return (v0 & 0xffff) | (v1 << 16);
}

export function detuple0(v: number) {
  return v & 0xffff;
}

export function detuple1(v: number) {
  return (v >>> 16) & 0xffff;
}

export function tuple2<T1, T2>(value: [T1, T2], v0: T1, v1: T2): [T1, T2] {
  value[0] = v0;
  value[1] = v1;
  return value;
}

export function tuple3<T1, T2, T3>(value: [T1, T2, T3], v0: T1, v1: T2, v2: T3): [T1, T2, T3] {
  value[0] = v0;
  value[1] = v1;
  value[2] = v2;
  return value;
}

export function tuple4<T1, T2, T3, T4>(value: [T1, T2, T3, T4], v0: T1, v1: T2, v2: T3, v3: T4): [T1, T2, T3, T4] {
  value[0] = v0;
  value[1] = v1;
  value[2] = v2;
  value[3] = v3;
  return value;
}

export function productValue<T>(start: T, f: (lh: T, rh: T) => T) {
  return {
    get: () => start,
    set: (v: T) => start = f(start, v)
  }
}

export function minValue(start: number) {
  return productValue(start, (lh, rh) => Math.min(rh, lh));
}

export function memoize<T, U>(f: (t: T) => U) {
  const cache = new Map<T, U>();
  return (t: T) => {
    let cached = cache.get(t);
    if (cached == undefined) {
      cached = f(t);
      cache.set(t, cached);
    }
    return cached;
  }
}


export function bilinear<T>(w: number, h: number, data: T[], inter: Interpolator<T>) {
  const hx = 1 / (w * 2);
  const hy = 1 / (h * 2);
  return (x: number, y: number): T => {
    x = fract(x);
    y = fract(y);
    const cx = Math.floor((x - hx) * w);
    const cy = Math.floor((y - hy) * h);
    const cx0 = cyclic(cx, w);
    const cx1 = cyclic(cx + 1, w);
    const cy0 = cyclic(cy, h) * w;
    const cy1 = cyclic(cy + 1, h) * w;
    const r1 = data[cx0 + cy0];
    const r2 = data[cx1 + cy0];
    const r3 = data[cx0 + cy1];
    const r4 = data[cx1 + cy1];
    const fracx = (x - (cx + 0.5) / w) * w;
    const fracy = (y - (cy + 0.5) / h) * h;
    return inter(inter(r1, r2, fracx), inter(r3, r4, fracx), fracy);
  }
}
