import { clamp, cyclic, fract, mix, monoatan2 } from "../../../../utils/mathutils";
import { VecStack } from '../../../../utils/vecstack';

export type SdfShape = (stack: VecStack, pos: number) => number;
export type SdfShapeRenderer = (stack: VecStack, pos: number, normal: number) => number;
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
    const f = stack.sub(stack.apply(stack.sub(scaled, gridPos), Math.abs), offset);
    const closest = stack.div(stack.add(gridPos, stack.push(stack.x(f) < 0.5 ? 0 : 1, stack.y(f) < 0.5 ? 0 : 1, 0, 0)), scale);
    return stack.push(stack.distance(pos, closest), 0, 0, 1);
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
        const d = stack.call(displacement, stack.apply(p, wrap));
        const dx = stack.x(d);
        const dy = stack.y(d);
        const displaced = stack.div(stack.add(p, stack.push(dx, dy, 0, 0)), scale);
        mind = Math.min(mind, stack.sqrdistance(displaced, pos));
        stack.end();
      }
    }
    return stack.push(Math.sqrt(mind), 0, 0, 1);
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
    return stack.pushScalar(res);
  }
}

export function circularArray(segments: number, img: SdfShape) {
  return (stack: VecStack, pos: number) => {
    const p = stack.sub(pos, stack.half);
    const ang = monoatan2(stack.x(p), stack.y(p));
    const angn = ang / (2 * Math.PI);
    const x = fract(angn * segments);
    const y = 1 - Math.hypot(stack.x(p), stack.y(p));
    const npos = stack.push(x, y, 0, 0);
    return stack.call(img, npos);
  }
}

export function decircular(scale: number, img: SdfShape) {
  return (stack: VecStack, pos: number) => {
    const ang = stack.x(pos) * Math.PI * 2 * stack.x(scale) + stack.y(scale) * Math.PI * 2;
    const l = stack.y(pos);
    const x = Math.sin(ang);
    const y = Math.cos(ang);
    return stack.call(img, stack.add(stack.push(0.5, 0.5, 0, 0), stack.push(x * l, y * l, 0, 0)));
  }
}

export function sdf3d(shape: SdfShape, renderer: SdfShapeRenderer): SdfShape {
  return (stack: VecStack, pos: number) => {
    const p = stack.copy(stack.allocate(), pos);
    let z = -1;
    let dist = Number.MAX_VALUE;
    let iters = 100;
    while (dist > 0.0001 && iters > 0 && z < 1) {
      stack.begin();
      stack.setz(p, z);
      dist = stack.callScalar(shape, p);
      z += dist;
      iters--;
      stack.end();
    }
    if (dist > 0.0001) return stack.push(0, 0, 0, 1);

    const normal = stack.call(calcNormal, pos, shape);
    return stack.call(renderer, p, normal);
  }
}

export function softShadow(stack: VecStack, pos: number, toLight: number, shape: SdfShape): number {
  let shadow = 1;
  let ph = 1e20;
  let l = 0.01;
  let radius = l;
  for (let i = 0; i < 100; i++) {
    const scaledToLight = stack.scale(toLight, l);
    const d = stack.callScalar(shape, stack.add(pos, scaledToLight));

    // const y = d * d / (2.0 * ph);
    // const z = Math.sqrt(d * d - y * y);
    // shadow = Math.min(shadow, penumbra * z / Math.max(0.0, l - y));
    // shadow = Math.min(shadow, penumbra * d / l)
    // ph = d;
    // l += d;
    // if (d <= 0.0001) { shadow = 0.0; break }
    // if (l > 1) break;

    shadow = Math.min(shadow, 10 * d / radius);
    radius += clamp(d, 0.02, 0.1);
    l += d;
    if (d <= 0.0001) { shadow = 0.0; break }
    if (l > 1) break;

  }
  const r = clamp(shadow, 0, 1);
  return stack.pushScalar(r * r * (3 - 2 * r));
}

const D = 0.0001;
export function calcNormal(stack: VecStack, pos: number, shape: SdfShape): number {
  const dx = stack.push(D, 0, 0, 0);
  const dy = stack.push(0, D, 0, 0);
  const dz = stack.push(0, 0, D, 0);
  return stack.normalize(stack.push(
    stack.callScalar(shape, stack.add(pos, dx)) - stack.callScalar(shape, stack.sub(pos, dx)),
    stack.callScalar(shape, stack.add(pos, dy)) - stack.callScalar(shape, stack.sub(pos, dy)),
    stack.callScalar(shape, stack.add(pos, dz)) - stack.callScalar(shape, stack.sub(pos, dz)),
    0));
}

export function ambientOcclusion(stack: VecStack, pos: number, normal: number, shape: SdfShape): number {
  let occ = 0;
  let sca = 1;
  for (let i = 0; i < 5; i++) {
    const h = 0.001 + 0.15 * i / 4.0;
    const scaledN = stack.scale(normal, h);
    const npos = stack.add(pos, scaledN);
    const d = stack.callScalar(shape, npos);
    occ += (h - d) * sca;
    sca *= 0.95;
  }
  return stack.pushScalar(clamp(1 - 1.5 * occ, 0, 1));
}


