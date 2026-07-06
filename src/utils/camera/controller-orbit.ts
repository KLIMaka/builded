import { vec3, mat4, vec2 } from "gl-matrix";
import { arrayEq, Source, Value, ValuesContainer } from "ts-utils/callbacks";
import { rad2deg } from "ts-utils/mathutils";
import { tuple } from "ts-utils/types";

const TRAGET = vec3.fromValues(0, 0, 0);

export type OrbitController = {
  view: Source<mat4>,
  projection: Source<mat4>,
  angles: Source<[number, number]>,
  yawPitchDistance: Value<vec3>,
  size: Value<vec2>,
  track: (x: number, y: number, track: boolean) => void,
  trackZoom: (dz: number) => void,
}

export function orbitController(v: ValuesContainer): OrbitController {
  const yawPitchDistance = v.valueBuilder({ name: 'yaw-pitch-distance', value: vec3.fromValues(0, 0, 64), eq: vec3.exactEquals });
  const angles = v.transformed('angles', yawPitchDistance, ([yaw, pitch]) => tuple(-rad2deg(pitch), rad2deg(yaw)));
  const view = v.transformed('view-matrix', yawPitchDistance, ([yaw, pitch, distance]) => {
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const eye = vec3.fromValues(
      distance * cp * sy,
      distance * sp,
      distance * cp * cy);
    return mat4.lookAt(mat4.create(), eye, TRAGET, [0, 1, 0]);
  }, { eq: mat4.exactEquals });
  const size = v.valueBuilder({ name: 'size', value: tuple(0, 0), eq: arrayEq });
  const aspect = v.transformed("aspect", size, ([w, h]) => w / h);
  const projection = v.transformed('projection', aspect, aspect => mat4.perspective(mat4.create(), 45, aspect, 1, Number.POSITIVE_INFINITY));
  let lastX = 0;
  let lastY = 0;
  const limit = Math.PI / 2 - 0.001;
  const track = (ex: number, ey: number, track: boolean) => {
    if (track) {
      const dx = (ex - lastX) * 0.005;
      const dy = (ey - lastY) * 0.005;
      yawPitchDistance.mod(([pyaw, ppitch, pdistance]) => [pyaw - dx, Math.max(-limit, Math.min(limit, ppitch + dy)), pdistance]);
    }
    lastX = ex;
    lastY = ey;
  }
  const trackZoom = (dz: number) => yawPitchDistance.mod(([pyaw, ppitch, pdistance]) => [pyaw, ppitch, Math.max(16, pdistance + dz)])

  return { view, projection, yawPitchDistance, size, angles, track, trackZoom }
}