import { Source, Value, ValuesContainer, arrayEq } from 'ts-utils/callbacks';
import { mat4, vec3 } from 'gl-matrix';
import { deg2rad, monoatan2, rad2deg } from 'ts-utils/mathutils';

export class Camera {
  readonly transform: Source<mat4>;
  readonly position: Value<vec3>;
  readonly forward: Source<vec3>;
  readonly side: Source<vec3>;
  readonly angle: Value<[number, number]>;

  constructor(values: ValuesContainer, x: number, y: number, z: number, ax: number, ay: number) {
    this.position = values.valueBuilder<vec3>({ name: 'position', value: vec3.fromValues(x, y, z), eq: vec3.exactEquals });
    this.angle = values.valueBuilder({ name: 'angle', value: [ax, ay], eq: arrayEq });
    this.transform = values.transformedTuple('transform', [this.position, this.angle], ([pos, ang]) => {
      const mat = mat4.create();
      const [angx, angy] = ang;
      mat4.identity(mat);
      mat4.rotateX(mat, mat, deg2rad(-angx));
      mat4.rotateY(mat, mat, deg2rad(-angy));
      vec3.negate(pos, pos);
      mat4.translate(mat, mat, pos);
      vec3.negate(pos, pos);
      return mat;
    });
    this.forward = values.transformed('forward', this.transform, trans => vec3.fromValues(-trans[2], -trans[6], -trans[10]))
    this.side = values.transformed('side', this.transform, trans => vec3.fromValues(trans[0], trans[4], trans[8]))
  }

  setPosition(x: number, y: number, z: number): void {
    this.position.set(vec3.fromValues(x, y, z));
  }

  updateAngles(dx: number, dy: number): void {
    this.angle.mod(([ax, ay]) => [Math.max(-90, Math.min(90, ax - dy)), ay - dx]);
  }

  setAngles(ax: number, ay: number): void {
    this.angle.set([Math.max(-90, Math.min(90, ax)), ay]);
  }

  lookTo(x: number, y: number, z: number) {
    const v = vec3.sub(vec3.create(), vec3.fromValues(x, y, z), this.position.get());
    const l = vec3.len(v);
    const ax = rad2deg(Math.asin(v[1] / l));
    const ay = rad2deg(monoatan2(v[2], v[0]));
    this.setAngles(ax, ay);
  }
}