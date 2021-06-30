import { clamp, cyclic, fract, mix, monoatan2 } from "../../../utils/mathutils";
import { VecStack } from '../../../utils/vecstack';

export type SdfShape = (stack: VecStack, pos: number) => number;
export type DistanceOperation = (d1: number, d2: number) => number;

export function SdfReducer(op: DistanceOperation) {
  return (s1: SdfShape, s2: SdfShape) => (stack: VecStack, pos: number) => {
    const d1 = stack.call(s1, pos);
    const d2 = stack.call(s2, pos);
    return stack.push(op(stack.x(d1), stack.x(d2)), 0, 0, 0);
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

export function pointGrid(scale: number, offset: number) {
  return (stack: VecStack, pos: number) => {
    const scaled = stack.mul(pos, scale);
    const gridPos = stack.add(stack.apply(scaled, Math.floor), offset);
    const f = stack.sub(stack.apply(scaled, fract), offset);
    const closest = stack.div(stack.add(gridPos, stack.push(stack.x(f) < 0.5 ? 0 : 1, stack.y(f) < 0.5 ? 0 : 1, 0, 0)), scale);
    return stack.push(stack.distance(pos, closest), 0, 0, 0);
  }
}

export function displacedPointGrid(scale: number, offset: number, displacement: (stack: VecStack, pos: number) => number) {
  return (stack: VecStack, pos: number) => {
    const scaled = stack.mul(stack.add(pos, offset), scale);
    const gridPos = stack.apply(scaled, Math.floor);
    const wrap = (x: number) => cyclic(x, stack.x(scale))
    let mind = Number.MAX_VALUE;
    for (let y = -1; y <= 1; y++) {
      for (let x = -1; x <= 1; x++) {
        stack.begin();
        const p = stack.add(gridPos, stack.push(x, y, 0, 0));
        const displaced = stack.div(stack.add(p, stack.call(displacement, stack.apply(p, wrap))), scale);
        mind = Math.min(mind, stack.sqrdistance(displaced, pos));
        stack.end();
      }
    }
    return stack.push(Math.sqrt(mind), 0, 0, 0);
  }
}

export function lineSegment(p1: number, p2: number) {
  return (stack: VecStack, pos: number) => {
    const p1p2 = stack.sub(p2, p1);
    const p1pos = stack.sub(pos, p1);
    const p1p2sqrLen = stack.dot(p1p2, p1p2);
    const dot = stack.dot(p1p2, p1pos);
    const t = dot / p1p2sqrLen;
    let res = 0;
    if (dot < 0) res = stack.distance(p1, pos)
    else if (t > 1) res = stack.distance(p2, pos);
    else res = stack.distance(pos, stack.add(p1, stack.scale(p1p2, t)));
    return stack.push(res, 0, 0, 0);
  }
}

export function circularArray(segments: number, sdf: SdfShape) {
  return (stack: VecStack, pos: number) => {
    const p = stack.sub(pos, stack.push(0.5, 0.5, 0, 0));
    const ang = monoatan2(stack.x(p), stack.y(p));
    const angn = ang / (2 * Math.PI);
    const x = fract(angn * segments);
    const y = 1 - stack.length(p);
    const npos = stack.push(x, y, 0, 0);
    return stack.call(sdf, npos);
  }
}

export function decircular(sdf: SdfShape) {
  return (stack: VecStack, pos: number) => {
    const ang = stack.x(pos) * Math.PI * 2;
    const l = 1 - stack.y(pos);
    const x = Math.cos(ang);
    const y = Math.sin(ang);
    return stack.call(sdf, stack.add(stack.push(0.5, 0.5, 0, 0), stack.push(x * l, y * l, 0, 0)));
  }
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

