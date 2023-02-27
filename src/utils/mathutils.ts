import { getOrCreate, map, range } from "./collections";
import { Interpolator, NumberInterpolator } from "./interpolator";
import { List } from "./list";

export const radsInDeg = 180 / Math.PI;
export const degInRad = Math.PI / 180;
export const PI2 = Math.PI * 2;
export const EPS = 1e-9;
export const HASH = (Math.sqrt(5) - 1) / 2;

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

export function clamp(x: number, min = 0.0, max = 1.0) {
  return x > max ? max : x < min ? min : x;
}

export function mix(x: number, y: number, d: number) {
  return x + (y - x) * d;
}

export function normalize(x: number, min: number, max: number): number {
  const d = max - min;
  return (x - min) / d;
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
  const atan = Math.atan2(y, x);
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

export function cubic(x: number): number {
  return 3 * x * x - 2 * x * x * x;
}

export function smothstep(x: number, min: number, max: number) {
  if (x < min) return 0;
  if (x > max) return 1;
  return cubic((x - min) / (max - min));
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

export function vec42int(x: number, y: number, z: number, w: number) {
  return x | (y << 8) | (z << 16) | (w << 24);
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

export function quadratic(x0: number, x1: number, x2: number, t: number) {
  // const a2 = (x2 - x0) * 2 - (x1 - x0) * 4;
  // const a1 = (x1 - x0) * 2 - a2 * 0.5;
  const a0 = x0;
  const a1 = x0 * -3 + x1 * 4 - x2;
  const a2 = x0 * 2 - x1 * 4 + x2 * 2;
  return a0 + a1 * t + a2 * t * t;
}

export function biquad(w: number, h: number, data: number[], wrap: (x: number, max: number) => number = cyclic) {
  return (x: number, y: number): number => {
    const sx = x * w;
    const sy = y * h;
    const cx = Math.round(sx - 0.5);
    const cy = Math.round(sy - 0.5);
    const cx0 = wrap(cx - 1, w);
    const cx1 = wrap(cx + 0, w);
    const cx2 = wrap(cx + 1, w);
    const cy0 = wrap(cy - 1, h) * w;
    const cy1 = wrap(cy + 0, h) * w;
    const cy2 = wrap(cy + 1, h) * w;

    const fracx = (0.25 + 0.5 * (sx - cx));
    const fracy = (0.25 + 0.5 * (sy - cy));

    const q0 = quadratic(data[cx0 + cy0], data[cx1 + cy0], data[cx2 + cy0], fracx);
    const q1 = quadratic(data[cx0 + cy1], data[cx1 + cy1], data[cx2 + cy1], fracx);
    const q2 = quadratic(data[cx0 + cy2], data[cx1 + cy2], data[cx2 + cy2], fracx);

    return quadratic(q0, q1, q2, fracy);
  }
}

export function bilinear<T>(w: number, h: number, data: T[], inter: Interpolator<T>, wrap: (x: number, max: number) => number = cyclic) {
  return (x: number, y: number): T => {
    const sx = x * w;
    const sy = y * h;
    const cx = Math.floor(sx - 0.5);
    const cy = Math.floor(sy - 0.5);
    const cx0 = wrap(cx, w);
    const cx1 = wrap(cx + 1, w);
    const cy0 = wrap(cy, h) * w;
    const cy1 = wrap(cy + 1, h) * w;
    const r1 = data[cx0 + cy0];
    const r2 = data[cx1 + cy0];
    const r3 = data[cx0 + cy1];
    const r4 = data[cx1 + cy1];
    const fracx = (sx - cx - 0.5);
    const fracy = (sy - cy - 0.5);
    return inter(inter(r1, r2, fracx), inter(r3, r4, fracx), fracy);
  }
}

const PERMUTATIONS = [151, 160, 137, 91, 90, 15,
  131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23,
  190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33,
  88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166,
  77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244,
  102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196,
  135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250, 124, 123,
  5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42,
  223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9,
  129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228,
  251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107,
  49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254,
  138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180
];
const PERLIN = [...PERMUTATIONS, ...PERMUTATIONS];

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

const DIAG = Math.SQRT2;
const grads = [[1, 0], [-1, 0], [DIAG, -DIAG], [0, -1], [DIAG, DIAG], [0, 1], [-DIAG, DIAG], [-DIAG, -DIAG]];

function grad2d(hash: number, x: number, y: number) {
  const h = hash & 7;
  const grad = grads[h]
  return grad[0] * x + grad[1] * y;
}

export function perlin2d(x: number, y: number) {
  const intx = Math.floor(x);
  const inty = Math.floor(y);
  const X = intx & 255;
  const Y = inty & 255;
  x -= intx;
  y -= inty;
  const u = fade(x);
  const v = fade(y);
  const A = PERLIN[X] + Y;
  const AA = PERLIN[A];
  const AB = PERLIN[A + 1];
  const B = PERLIN[X + 1] + Y;
  const BA = PERLIN[B];
  const BB = PERLIN[B + 1];
  return NumberInterpolator(
    NumberInterpolator(grad2d(PERLIN[AA], x, y), grad2d(PERLIN[BA], x - 1, y), u),
    NumberInterpolator(grad2d(PERLIN[AB], x, y - 1), grad2d(PERLIN[BB], x - 1, y - 1), u),
    v);
}


const POWS = [...map(range(0, 20), x => 1 / Math.pow(2, x))];
export function octaves2d(f: (x: number, y: number) => number, octaves: number) {
  return (x: number, y: number) => {
    let sum = 0;
    let norm = 0;
    for (let i = 1; i <= octaves; i++) {
      const k = POWS[i - 1];
      sum += f(x * i, y * i) * k;
      norm += k;
    }
    return sum / norm;
  }
}

export class HashMap<K, V> {
  private map = new Map<number, [K, V][]>();
  constructor(private hash: (k: K) => number, private eq: (lh: K, rh: K) => boolean) { }

  get(key: K): V {
    const hash = this.hash(key);
    const slot = this.findSlot(getOrCreate(this.map, hash, _ => []), key);
    return slot == undefined ? undefined : slot[1];
  }

  set(key: K, value: V) {
    const hash = this.hash(key);
    const slot = this.findSlot(getOrCreate(this.map, hash, _ => []), key);
    if (slot == undefined) {
      const newSlot: [K, V] = [key, value];
      this.map.get(hash).push(newSlot);
    } else {
      slot[1] = value;
    }
  }

  private findSlot(bucket: [K, V][], key: K): [K, V] {
    for (const kv of bucket)
      if (this.eq(kv[0], key)) return kv;
    return undefined;
  }
}

const SCALE = 27644437;
export const Vec2Hash: (v: [number, number]) => number = ([x, y]) => (x * 9834497) ^ (y * 8503057);
export const Vec2Eq: (v1: [number, number], v2: [number, number]) => boolean = ([x1, y1], [x2, y2]) => x1 == x2 && y1 == y2;

function slope(f: (number) => number, x: number, d = 0.01): number {
  const y1 = f(x - d);
  const y2 = f(x + d);
  return (y2 - y1) / (2 * d);
}

export function optimize(f: (number) => number, count = 2, eps = 0.001): number {
  const x0 = f(0.5);
  let xp = x0;
  let xn = x0 - f(x0) / slope(f, x0);
  let i = 0;
  let dx = Math.abs(xp - xn);
  while (i < count && dx > eps) {
    xp = xn;
    xn = xp - f(xp) / slope(f, xp, dx);
    dx = Math.abs(xp - xn);
    i++;
  }
  return xn;
}

export type RadialSegment = { start: number, end: number };
export class RadialSegments {
  private segments = new List<RadialSegment>();

  has(x: number): boolean {
    for (let seg = this.segments.first(); seg != this.segments.terminator(); seg = seg.next)
      if (x >= seg.obj.start && x <= seg.obj.end) return true;
    return false;
  }



  add(seg: RadialSegment) {

  }

  remove(seg: RadialSegment) {

  }
}