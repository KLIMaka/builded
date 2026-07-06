import { mat4, vec2, vec3 } from 'gl-matrix';
import Optional from 'optional-js';
import { Source, Value, ValuesContainer } from 'ts-utils/callbacks';
import { deg2rad } from 'ts-utils/mathutils';
import { Camera } from './camera';

const EMPTY = mat4.create();

export class Controller3D {
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
    this.projection = values.transformedTuple('projection', [this.fovRad, this.aspect], ([fov, aspect]) => mat4.perspective(mat4.create(), fov, aspect, 1, Number.POSITIVE_INFINITY));
    const mat4Eq = { eq: mat4.exactEquals };
    const invertTransform = values.transformed('invertTransform', this.camera.transform, trans => Optional.ofNullable(mat4.invert(mat4.create(), trans)).orElse(EMPTY), mat4Eq);
    const invertProjection = values.transformed('invertProjection', this.projection, proj => Optional.ofNullable(mat4.invert(mat4.create(), proj)).orElse(EMPTY), mat4Eq);
    const invertTransfprmProjection = values.transformedTuple('invertTransfrmProjection', [invertTransform, invertProjection], ([t, p]) => mat4.mul(mat4.create(), t, p), mat4Eq);
    this.forwardMouse = values.transformedTuple('forwardMouse', [this.mousePos, this.size, invertTransfprmProjection, this.camera.position], ([[mx, my], [w, h], invTP, pos]) => {
      const x = (mx / w) * 2 - 1;
      const y = (my / h) * 2 - 1;
      const forward = vec3.fromValues(x, -y, -1);
      vec3.transformMat4(forward, forward, invTP);
      vec3.sub(forward, forward, pos);
      return vec3.normalize(forward, forward);
    }, { eq: vec3.exactEquals });
  }

  setFov(fov: number) {
    this.fovRad.set(deg2rad(fov));
  }

  setSize(w: number, h: number) {
    this.size.set(vec2.fromValues(w, h));
  }

  getSize(): vec2 {
    return this.size.get();
  }

  getProjectionMatrix(): mat4 {
    return this.projection.get();
  }

  getTransformMatrix() {
    return this.camera.transform.get();
  }

  getPosition() {
    return this.camera.position;
  }

  getForwardUnprojected(): vec3 {
    return this.forwardMouse.get();
  }

  setPosition(x: number, y: number, z: number) {
    this.camera.setPosition(x, y, z);
  }

  getForward() {
    return this.camera.forward.get();
  }

  moveForward(dist: number) {
    const forward = vec3.copy(vec3.create(), this.camera.forward.get());
    const campos = vec3.copy(vec3.create(), this.camera.position.get());
    vec3.scale(forward, forward, dist);
    vec3.add(campos, campos, forward);
    this.camera.setPosition(campos[0], campos[1], campos[2]);
  }

  moveSideway(dist: number) {
    const sideways = vec3.copy(vec3.create(), this.camera.side.get());
    const campos = vec3.copy(vec3.create(), this.camera.position.get());
    vec3.scale(sideways, sideways, dist);
    vec3.add(campos, campos, sideways);
    this.camera.setPosition(campos[0], campos[1], campos[2]);
  }

  track(x: number, y: number, move: boolean) {
    const [mx, my] = this.mousePos.get();
    if (move) this.camera.updateAngles((x - mx) / 2, (y - my) / 2);
    this.mousePos.set(vec2.fromValues(x, y));
  }

  trackOrbit(x: number, y: number, move: boolean) {
    const [mx, my] = this.mousePos.get();
    if (move) {
      this.camera.updateAngles((x - mx) / 2, (y - my) / 2);
      const [ax, ay] = this.camera.angle.get();
      const axRad = deg2rad(ax);
      const ayRad = deg2rad(ay);
      const cx = Math.cos(axRad);
      const cy = Math.cos(ayRad);
      const sx = Math.sin(axRad);
      const sy = Math.sin(ayRad);
      const nx = 100 * cx * cy;
      const ny = 100 * sy;
      const nz = 100 * cx * sy;
      this.camera.setPosition(nx, ny, nz);
      this.camera.lookTo(0, 0, 0);
    }
    this.mousePos.set(vec2.fromValues(x, y));
  }

  getCamera(): Camera {
    return this.camera;
  }
}