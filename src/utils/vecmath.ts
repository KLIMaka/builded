import { mat2d, mat3, mat4, vec2, vec3 } from 'gl-matrix';
import * as MU from './mathutils';
import { loopPairs, pairs } from "./collections";

export function intersect2d(p1s: vec2, p1e: vec2, p2s: vec2, p2e: vec2): vec2 {
  const t = intersect2dT(p1s, p1e, p2s, p2e);
  if (t == null)
    return null;
  return vec2.lerp(vec2.create(), p1s, p1e, t);
}


export function intersect2dT(p1s: vec2, p1e: vec2, p2s: vec2, p2e: vec2): number {
  const d = (p1s[0] - p1e[0]) * (p2s[1] - p2e[1]) - (p1s[1] - p1e[1]) * (p2s[0] - p2e[0]);
  if (Math.abs(d) < MU.EPS) return null;

  const res0 = ((p1s[0] * p1e[1] - p1s[1] * p1e[0]) * (p2s[0] - p2e[0]) - (p1s[0] - p1e[0]) * (p2s[0] * p2e[1] - p2s[1] * p2e[0])) / d;
  const res1 = ((p1s[0] * p1e[1] - p1s[1] * p1e[0]) * (p2s[1] - p2e[1]) - (p1s[1] - p1e[1]) * (p2s[0] * p2e[1] - p2s[1] * p2e[0])) / d;

  const dx1 = p1e[0] - p1s[0];
  const dy1 = p1e[1] - p1s[1];
  const dot1 = ((res0 - p1s[0]) * dx1 + (res1 - p1s[1]) * dy1) / MU.sqrLen2d(dx1, dy1);

  if (dot1 < 0.0 || dot1 > 1.0) return null;

  const dx2 = p2e[0] - p2s[0];
  const dy2 = p2e[1] - p2s[1];
  const dot2 = ((res0 - p2s[0]) * dx2 + (res1 - p2s[1]) * dy2) / MU.sqrLen2d(dx2, dy2);
  if (dot2 < 0.0 || dot2 > 1.0) return null;

  return dot1;
}

export function direction3d(ps: vec3, pe: vec3): vec3 {
  const dir = vec3.sub(vec3.create(), pe, ps);
  return vec3.normalize(dir, dir);
}

export function direction2d(ps: vec2, pe: vec2): vec2 {
  const dir = vec2.sub(vec2.create(), pe, ps);
  return vec2.normalize(dir, dir);
}

export function projectXY(p: vec3): vec2 { return vec2.fromValues(p[0], p[1]) }
export function projectXZ(p: vec3): vec2 { return vec2.fromValues(p[0], p[2]) }
export function projectYZ(p: vec3): vec2 { return vec2.fromValues(p[1], p[2]) }

export function intersect3d(p1s: vec3, p1e: vec3, p2s: vec3, p2e: vec3): vec3 {
  const dir1 = direction3d(p1s, p1e);
  const dir2 = direction3d(p2s, p2e);

  const p =
    (dir1[1] * dir2[0] - dir2[1] * dir1[0]) != 0 ? projectXY :
      (dir1[0] * dir2[1] - dir2[0] * dir1[1]) != 0 ? projectXZ :
        (dir1[1] * dir2[2] - dir2[1] * dir1[2]) != 0 ? projectYZ :
          null;

  if (p == null)
    return null;
  const p1s_ = p(p1s);
  const p2s_ = p(p2s);
  const p1e_ = p(p1e);
  const p2e_ = p(p2e);
  const t = intersect2dT(p1s_, p1e_, p2s_, p2e_);

  if (t == null)
    return null;
  return vec3.lerp(vec3.create(), p1s, p1e, t);
}

export function reflectVec3d(out: vec3, id: vec3, n: vec3): vec3 {
  const dot = vec3.dot(n, id);
  vec3.scale(out, n, dot * 2);
  vec3.sub(out, id, out);
  return out;
}

const tmp = vec3.create();
export function reflectPoint3d(out: vec3, mirrorNormal: vec3, mirrorD: number, point: vec3) {
  const t = vec3.dot(point, mirrorNormal) + mirrorD;
  vec3.scale(tmp, mirrorNormal, t * 2)
  return vec3.sub(out, point, tmp);
}

export function normal2d(out: vec2, vec: vec2) {
  vec2.set(out, vec[1], -vec[0]);
  return vec2.normalize(out, out);
}

const side = vec3.create();
const up = vec3.create();
const forward = vec3.create();
const oside = vec3.create();
const oup = vec3.create();
const oforward = vec3.create();
const mirroredPos = vec3.create();
export function mirrorBasis(out: mat4, mat: mat4, point: vec3, mirrorNormal: vec3, mirrorD: number) {
  vec3.set(oside, mat[0], mat[4], mat[8]);
  vec3.set(oup, mat[1], mat[5], mat[9]);
  vec3.set(oforward, mat[2], mat[6], mat[10]);
  reflectVec3d(side, oside, mirrorNormal);
  reflectVec3d(up, oup, mirrorNormal);
  reflectVec3d(forward, oforward, mirrorNormal);
  reflectPoint3d(mirroredPos, mirrorNormal, mirrorD, point);

  mat4.identity(out);
  out[0] = side[0]; out[1] = up[0]; out[2] = forward[0]; out[3] = 0;
  out[4] = side[1]; out[5] = up[1]; out[6] = forward[1]; out[7] = 0;
  out[8] = side[2]; out[9] = up[2]; out[10] = forward[2]; out[11] = 0;
  vec3.negate(mirroredPos, mirroredPos);
  mat4.translate(out, out, mirroredPos);
  return out;
}


//
//   p1     p3
//    \ ang /
//     \ ^ /
//      \ /
//      p2
// export function ang2d(p1:vec2, p2:vec2, p3:vec2):number {
//   const toNext = subCopy2d(p3, p2); normalize2d(toNext);
//   const toPrev = subCopy2d(p1, p2); normalize2d(toPrev);
//   const angToNext = Math.acos(toNext[0]);
//   angToNext = toNext[1] < 0 ? MU.PI2 - angToNext : angToNext;
//   const angToPrev = Math.acos(toPrev[0]);
//   angToPrev = toPrev[1] < 0 ? MU.PI2 - angToPrev : angToPrev;
//   release2d(toNext); release2d(toPrev);
//   const ang = angToNext - angToPrev;
//   ang = (ang < 0 ? MU.PI2 + ang : ang);
//   return ang;
// }

// export function isCW(polygon:VecArray[]):boolean {
//   const angsum = 0;
//   const N = polygon.length;
//   for (const i = 0; i < N; i++) {
//     const curr = polygon[i];
//     const prev = polygon[i == 0 ? N - 1 : i - 1];
//     const next = polygon[i == N - 1 ? 0 : i + 1];
//     angsum += ang2d(prev, curr, next);
//   }
//   return MU.rad2deg(angsum) == 180*(N-2);
// }


export function projectionSpace(vtxs: vec3[], n: vec3): mat3 {
  const a = vec3.create();
  vec3.normalize(a, vec3.sub(a, vtxs[0], vtxs[1]));
  const c = vec3.create();
  vec3.normalize(c, vec3.cross(c, n, a));
  return [
    a[0], c[0], n[0],
    a[1], c[1], n[1],
    a[2], c[2], n[2]
  ];
}

export function project3d(vtxs: vec3[], normal: vec3): vec2[] {
  const mat = projectionSpace(vtxs, normal);
  const ret = [];
  const t = vec3.create();
  for (let i = 0; i < vtxs.length; i++) {
    const vtx = vec3.transformMat3(t, vtxs[i], mat);
    ret.push([vtx[0], vtx[1]]);
  }
  return ret;
}

export function polygonNormal(vtxs: vec3[]): vec3 {
  const normal = vec3.create();
  for (const [v1, v2] of loopPairs(vtxs)) {
    const cross = vec3.cross(normal, v1, v2);
    const l = vec3.length(cross)
    if (l <= 0) continue;
    return vec3.scale(normal, normal, 1 / l);
  }
  return null;
}

function norm(verts: vec2[], rad: number): number {
  const mat = mat2d.fromRotation(mat2d.create(), rad);
  let minx = Number.MAX_VALUE;
  let miny = Number.MAX_VALUE;
  let maxx = Number.MIN_VALUE;
  let maxy = Number.MIN_VALUE;
  const vtx = vec2.create();
  verts.forEach(v => {
    vec2.transformMat2d(vtx, v, mat);
    minx = Math.min(minx, vtx[0]);
    miny = Math.min(miny, vtx[1]);
    maxx = Math.max(maxx, vtx[0]);
    maxy = Math.max(maxy, vtx[1]);
  });
  return (maxx - minx) * (maxy - miny);
}

export function optimizeRotation(verts: vec2[]) {

}



