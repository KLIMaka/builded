import { Value, Source, ValuesContainer } from "ts-utils/callbacks";
import { deg2rad } from "ts-utils/mathutils";
import { vec2, mat4, vec3 } from "gl-matrix";
import { Camera } from "./camera";

const invertTrans = mat4.create();
const invTP = mat4.create();

export class ControllerOrbit {
  readonly camera: Camera;
  readonly size: Value<vec2>;
  readonly mousePos: Value<vec2>;
  readonly fovRad: Value<number>;
  readonly aspect: Source<number>;
  readonly projection: Source<mat4>;
  readonly forwardMouse: Source<vec3>;

  constructor(values: ValuesContainer) {
    this.camera = new Camera(values, 0, 0, 0, 0, 0);
    this.size = values.valueBuilder<vec2>({ name: 'size', value: vec2.create(), eq: vec2.exactEquals });
    this.mousePos = values.valueBuilder<vec2>({ name: 'mousePos', value: vec2.create(), eq: vec2.exactEquals });
    this.fovRad = values.value('fovRad', deg2rad(90))
    this.aspect = values.transformed('aspect', this.size, ([w, h]) => w / h);
    this.projection = values.transformedTuple('projection', [this.fovRad, this.aspect], ([fov, aspect]) => mat4.perspective(mat4.create(), fov, aspect, 1, null));
    this.forwardMouse = values.transformedTuple('forwardMouse', [this.mousePos, this.size, this.projection, this.camera.transform, this.camera.position], ([[mx, my], [w, h], proj, trans, pos]) => {
      const x = (mx / w) * 2 - 1;
      const y = (my / h) * 2 - 1;
      mat4.invert(invertTrans, trans);
      mat4.invert(invTP, proj);
      mat4.mul(invTP, invertTrans, invTP);

      const forward = vec3.set(vec3.create(), x, -y, -1);
      vec3.transformMat4(forward, forward, invTP);
      vec3.sub(forward, forward, pos);
      return vec3.normalize(forward, forward);
    }, { eq: (l: vec3, r: vec3) => vec3.exactEquals(l, r) });
  }

  setOrigin(x: number, y: number, z: number) {

  }
}