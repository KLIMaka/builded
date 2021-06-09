import { clamp, fract, mix } from "../../../utils/mathutils";
import { VecStack2d, VecStack3d } from '../../../utils/vecstack';

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
    const p = stack.get(pos);
    return f(p[0], p[1]);
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

