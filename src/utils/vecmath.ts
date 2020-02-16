import * as GLM from '../libs_js/glmatrix';
import * as MU from './mathutils';

export function intersect2d(p1s:GLM.Vec2Array, p1e:GLM.Vec2Array, p2s:GLM.Vec2Array, p2e:GLM.Vec2Array):GLM.Vec2Array {
  let t = intersect2dT(p1s, p1e, p2s, p2e);
  if (t == null)
    return null;
  return GLM.vec2.lerp(GLM.vec2.create(), p1s, p1e, t);
}


export function intersect2dT(p1s:GLM.Vec2Array, p1e:GLM.Vec2Array, p2s:GLM.Vec2Array, p2e:GLM.Vec2Array):number {
  let d = (p1s[0]-p1e[0])*(p2s[1]-p2e[1]) - (p1s[1]-p1e[1])*(p2s[0]-p2e[0]);
  if (Math.abs(d) < MU.EPS)
    return null;
  let res0 = ((p1s[0]*p1e[1]-p1s[1]*p1e[0])*(p2s[0]-p2e[0]) - (p1s[0]-p1e[0])*(p2s[0]*p2e[1]-p2s[1]*p2e[0])) / d;
  let res1 = ((p1s[0]*p1e[1]-p1s[1]*p1e[0])*(p2s[1]-p2e[1]) - (p1s[1]-p1e[1])*(p2s[0]*p2e[1]-p2s[1]*p2e[0])) / d;

  let dx1 = p1e[0]-p1s[0];
  let dy1 = p1e[1]-p1s[1];
  let dot1 = ((res0-p1s[0])*dx1 + (res1-p1s[1])*dy1) / MU.sqrLen2d(dx1, dy1);
  if (dot1 < 0.0 || dot1 > 1.0)
    return null;
  let dx2 = p2e[0]-p2s[0];
  let dy2 = p2e[1]-p2s[1];
  let dot2 = ((res0-p2s[0])*dx2 + (res1-p2s[1])*dy2) / MU.sqrLen2d(dx2, dy2);
  if (dot2 < 0.0 || dot2 > 1.0)
    return null;

  return dot1;
}

export function direction3d(ps:GLM.Vec3Array, pe:GLM.Vec3Array):GLM.Vec3Array {
  let dir = GLM.vec3.sub(GLM.vec3.create(), pe, ps);
  return GLM.vec3.normalize(dir, dir);
}

export function direction2d(ps:GLM.Vec2Array, pe:GLM.Vec2Array):GLM.Vec2Array {
  let dir = GLM.vec2.sub(GLM.vec2.create(), pe, ps);
  return GLM.vec2.normalize(dir, dir);
}

export function projectXY(p:GLM.Vec3Array):GLM.Vec2Array {return GLM.vec2.fromValues(p[0], p[1])}
export function projectXZ(p:GLM.Vec3Array):GLM.Vec2Array {return GLM.vec2.fromValues(p[0], p[2])}
export function projectYZ(p:GLM.Vec3Array):GLM.Vec2Array {return GLM.vec2.fromValues(p[1], p[2])}

export function intersect3d(p1s:GLM.Vec3Array, p1e:GLM.Vec3Array, p2s:GLM.Vec3Array, p2e:GLM.Vec3Array):GLM.Vec3Array {
  let dir1 = direction3d(p1s, p1e);
  let dir2 = direction3d(p2s, p2e);

  let p = 
    (dir1[1]*dir2[0] - dir2[1]*dir1[0]) != 0 ? projectXY :
    (dir1[0]*dir2[1] - dir2[0]*dir1[1]) != 0 ? projectXZ :
    (dir1[1]*dir2[2] - dir2[1]*dir1[2]) != 0 ? projectYZ :
    null;
  
  if (p == null)
    return null;
  let p1s_ = p(p1s);
  let p2s_ = p(p2s);
  let p1e_ = p(p1e);
  let p2e_ = p(p2e);
  let t = intersect2dT(p1s_, p1e_, p2s_, p2e_);

  if (t == null)
    return null;
  return GLM.vec3.lerp(GLM.vec3.create(), p1s, p1e, t);
}

export function reflectVec3d(out:GLM.Vec3Array, id:GLM.Vec3Array, n:GLM.Vec3Array):GLM.Vec3Array {
  let dot = GLM.vec3.dot(n, id);
  GLM.vec3.scale(out, n, dot * 2);
  GLM.vec3.sub(out, id, out);
  return out;
}

let tmp = GLM.vec3.create();
export function reflectPoint3d(out:GLM.Vec3Array, mirrorNormal:GLM.Vec3Array, mirrorD:number, point:GLM.Vec3Array) {
  let t = GLM.vec3.dot(point, mirrorNormal) + mirrorD;
  GLM.vec3.scale(tmp, mirrorNormal, t * 2)
  return GLM.vec3.sub(out, point, tmp);
}

export function normal2d(out:GLM.Vec2Array, vec:GLM.Vec2Array) {
  GLM.vec2.set(out, vec[1], -vec[0]);
  return GLM.vec2.normalize(out, out);
}

let side = GLM.vec3.create();
let up = GLM.vec3.create();
let forward = GLM.vec3.create();
let oside = GLM.vec3.create();
let oup = GLM.vec3.create();
let oforward = GLM.vec3.create();
let mirroredPos = GLM.vec3.create();
export function mirrorBasis(out:GLM.Mat4Array, mat:GLM.Mat4Array, point:GLM.Vec3Array, mirrorNormal:GLM.Vec3Array, mirrorD:number) {
  GLM.vec3.set(oside, mat[0], mat[4], mat[8]);
  GLM.vec3.set(oup, mat[1], mat[5], mat[9]);
  GLM.vec3.set(oforward, mat[2], mat[6], mat[10]);
  reflectVec3d(side, oside, mirrorNormal);
  reflectVec3d(up, oup, mirrorNormal);
  reflectVec3d(forward, oforward, mirrorNormal);
  reflectPoint3d(mirroredPos, mirrorNormal, mirrorD, point);

  GLM.mat4.identity(out);
  out[0] = side[0]; out[1] = up[0]; out[2] = forward[0]; out[3] = 0;
  out[4] = side[1]; out[5] = up[1]; out[6] = forward[1]; out[7] = 0;
  out[8] = side[2]; out[9] = up[2]; out[10] = forward[2]; out[11] = 0;
  GLM.vec3.negate(mirroredPos, mirroredPos);
  GLM.mat4.translate(out, out, mirroredPos);
  return out;
}

/*
export function normal2d(v1:GLM.Vec2Array, v2:GLM.Vec2Array):GLM.Vec2Array {
  let tmp = normalize2d(subCopy2d(v2, v1));
  let norm = fromValues2d(-tmp[1], tmp[0]);
  release2d(tmp);
  return norm;
}

//
//   p1     p3
//    \ ang /
//     \ ^ /
//      \ /
//      p2
export function ang2d(p1:GLM.Vec2Array, p2:GLM.Vec2Array, p3:GLM.Vec2Array):number {
  let toNext = subCopy2d(p3, p2); normalize2d(toNext);
  let toPrev = subCopy2d(p1, p2); normalize2d(toPrev);
  let angToNext = Math.acos(toNext[0]);
  angToNext = toNext[1] < 0 ? MU.PI2 - angToNext : angToNext;
  let angToPrev = Math.acos(toPrev[0]);
  angToPrev = toPrev[1] < 0 ? MU.PI2 - angToPrev : angToPrev;
  release2d(toNext); release2d(toPrev);
  let ang = angToNext - angToPrev;
  ang = (ang < 0 ? MU.PI2 + ang : ang);
  return ang;
}

export function isCW(polygon:GLM.VecArray[]):boolean {
  let angsum = 0;
  let N = polygon.length;
  for (let i = 0; i < N; i++) {
    let curr = polygon[i];
    let prev = polygon[i == 0 ? N - 1 : i - 1];
    let next = polygon[i == N - 1 ? 0 : i + 1];
    angsum += ang2d(prev, curr, next);
  }
  return MU.rad2deg(angsum) == 180*(N-2);
}


export function projectionSpace(vtxs:GLM.Vec3Array[], n:GLM.Vec3Array) {
  let a = normalize3d(subCopy3d(vtxs[0], vtxs[1]));
  let c = normalize3d(crossCopy3d(n, a));
  let ret = [
    a[0], c[0], n[0],
    a[1], c[1], n[1],
    a[2], c[2], n[2]
  ];
  release3d(a); release3d(c); 
  return ret;
}

export function project3d(vtxs:GLM.Vec3Array[], normal:GLM.Vec3Array):GLM.Vec2Array[] {
  let mat = projectionSpace(vtxs, normal);
  let ret = [];
  for (let i = 0; i < vtxs.length; i++) {
    let vtx = GLM.vec3.transformMat3(GLM.vec3.create(), vtxs[i], mat);
    ret.push([vtx[0], vtx[1]]);
  }
  return ret;
}
*/


