import { vec2 } from "../../../libs_js/glmatrix";
import { clamp, fract, mix, monoatan2 } from "../../../utils/mathutils";
import { VecStack2d, VecStack3d } from '../../../utils/vecstack';

export interface Output {
  spread(x: number): void;
  x(x: number): void;
  xy(x: number, y: number): void;
  xyz(x: number, y: number, z: number): void;
  xyzw(x: number, y: number, z: number, w: number): void;
}

export type A = (x: number, y: number, out: Output) => void;

export type SdfShape<T> = (stack: T, pos: number) => number;
export type DistanceOperation = (d1: number, d2: number) => number;

export function SdfReducer<T>(op: DistanceOperation) {
  return (stack: T, pos: number, s1: SdfShape<T>, s2: SdfShape<T>) => {
    const d1 = s1(stack, pos);
    const d2 = s2(stack, pos);
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

export function sdf2d(f: (x: number, y: number) => number) {
  return (stack: VecStack2d, pos: number) => {
    return f(stack.get(pos), stack.get(pos + 1));
  };
}

export function pointGrid(stack: VecStack2d, pos: number, scale: number, offset: number) {
  stack.start();
  const scaled = stack.mul(stack.add(pos, offset), scale);
  const gridPos = stack.apply(scaled, Math.floor);
  const f = stack.get(stack.apply(scaled, fract));
  const closest = stack.add(gridPos, stack.push(f[0] < 0.5 ? 0 : 1, f[1] < 0.5 ? 0 : 1));
  stack.stop();
  return stack.distance(pos, closest);
}

export function displacedPointGrid(stack: VecStack2d, pos: number, scale: number, offset: number, displacement: (stack: VecStack2d, pos: number) => number) {
  stack.start();
  const scaled = stack.mul(stack.add(pos, offset), scale);
  const gridPos = stack.apply(scaled, Math.floor);
  let mind = Number.MAX_VALUE;
  for (let y = -1; y < 1; y++) {
    for (let x = -1; x < 1; x++) {
      const p = stack.add(gridPos, stack.push(x, y));
      const displaced = stack.add(p, displacement(stack, p));
      mind = Math.min(mind, stack.distance(displaced, pos))
    }
  }
  stack.stop();
  return mind;
}

const t1 = vec2.create();
const t2 = vec2.create();
const t3 = vec2.create();

export function lineSegment(stack: VecStack2d, posId: number, p1Id: number, p2Id: number) {
  stack.start();
  const p1p2 = stack.sub(p2Id, p1Id);
  const p1pos = stack.sub(posId, p1Id);
  const p1p2sqrLen = stack.dot(p1p2, p1p2);
  const dot = stack.dot(p1p2, p1pos);
  const t = dot / p1p2sqrLen;
  let res = 0;
  if (dot < 0) res = stack.distance(p1Id, posId)
  else if (t > 1) res = stack.distance(p2Id, posId);
  else res = stack.distance(posId, stack.add(p1Id, stack.scale(p1p2, t)));
  stack.stop();
  return res;

  // const pos = stack.get(posId);
  // const p1 = stack.get(p1Id);
  // const p2 = stack.get(p2Id);

  // const p1p2x = p2[0] - p1[0];
  // const p1p2y = p2[1] - p1[1];
  // const p1posx = pos[0] - p1[0];
  // const p1posy = pos[1] - p1[1];
  // const p1p2sqrLen = p1p2x * p1p2x + p1p2y * p1p2y;
  // const dot = p1p2x * p1posx + p1p2y * p1posy;
  // const t = dot / p1p2sqrLen;
  // let res = 0;
  // if (dot < 0) res = Math.sqrt(p1p2sqrLen);
  // else if (t > 1) res = Math.hypot(pos[0] - p2[0], pos[1] - p2[1]);
  // else res = Math.hypot(p1posx - p1p2x * t, p1posy - p1p2y * t);
  // return res;

  // const p1p2 = vec2.sub(t1, p2, p1);
  // const p1pos = vec2.sub(t2, pos, p1);
  // const p1p2sqrLen = vec2.dot(p1p2, p1p2);
  // const dot = vec2.dot(p1p2, p1pos);
  // const t = dot / p1p2sqrLen;
  // let res = 0;
  // if (dot < 0) res = vec2.len(p1pos);
  // else if (t > 1) res = vec2.len(vec2.sub(t3, pos, p2));
  // else res = vec2.len(vec2.sub(t3, pos, vec2.add(t3, vec2.scale(t3, p1p2, t), p1)));
  // return res;
}

export function circularArray(stack: VecStack2d, pos: number, segments: number, sdf: SdfShape<VecStack2d>): number {
  stack.start();
  const p = stack.sub(pos, stack.push(0.5, 0.5));
  const ang = monoatan2(stack.get(p), stack.get(p + 1));
  const angn = ang / (2 * Math.PI);
  const x = fract(angn * segments);
  const y = 1 - stack.length(p);
  const npos = stack.push(x, y);
  const d = sdf(stack, npos);
  stack.stop();
  return d;
}

export function sdf3d(f: (x: number, y: number, z: number) => number) {
  return (stack: VecStack3d, pos: number) => {
    const p = stack.get(pos);
    return f(p[0], p[1], p[2]);
  };
}

export const sphere = (center: number, r: number) => (vecs: VecStack3d, pos: number) => vecs.distance(pos, center) - r;

export function softShadow(penumbra: number, vecs: VecStack3d, pos: number, toLight: number, s: SdfShape<VecStack3d>): number {
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

export function ambientOcclusion(vecs: VecStack3d, pos: number, normal: number, s: SdfShape<VecStack3d>): number {
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
export function normal(vecs: VecStack3d, pos: number, s: SdfShape<VecStack3d>): number {
  return vecs.start().return(vecs.normalized(
    vecs.push(
      s(vecs, vecs.add(pos, vecs.push(H, 0, 0))) - s(vecs, vecs.add(pos, vecs.push(-H, 0, 0))),
      s(vecs, vecs.add(pos, vecs.push(0, H, 0))) - s(vecs, vecs.add(pos, vecs.push(0, -H, 0))),
      s(vecs, vecs.add(pos, vecs.push(0, 0, H))) - s(vecs, vecs.add(pos, vecs.push(0, 0, -H))),
    )
  ));
}

