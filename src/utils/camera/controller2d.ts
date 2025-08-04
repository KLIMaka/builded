import { Source, Value, ValuesContainer } from "ts-utils/callbacks";
import { mat4, vec2, vec3 } from "gl-matrix";
import { Camera } from "./camera";

export class Controller2D {
  private camera: Camera;
  private size: Value<vec2>;
  private mousePos: Value<vec2>;
  private scale: Value<number>;
  private projection: Source<mat4>;

  constructor(values: ValuesContainer) {
    this.camera = new Camera(values, 0, 0, 0, 0, 0);
    this.size = values.valueBuilder<vec2>({ name: 'size', value: vec2.create(), eq: vec2.exactEquals });
    this.mousePos = values.valueBuilder<vec2>({ name: 'mousePos', value: vec2.create(), eq: vec2.exactEquals });
    this.scale = values.value('scale', 1);
    this.projection = values.transformedTuple('projection', [this.size, this.scale], ([[w, h], scale]) => {
      const projection = mat4.create();
      const wscale = w / 2 * scale;
      const hscale = h / 2 * scale;
      mat4.identity(projection);
      mat4.ortho(projection, -wscale, wscale, hscale, -hscale, 0, 0xFFFF);
      mat4.rotateX(projection, projection, -Math.PI / 2);
      return projection;
    });
  }

  track(x: number, y: number, z: number, move: boolean) {
    const [mx, my] = this.mousePos.get();
    const scale = this.scale.get();
    if (move) {
      const dx = (x - mx) * scale;
      const dy = (y - my) * scale;
      const pos = this.camera.position.get();
      this.camera.setPosition(pos[0] - dx, z, pos[2] - dy);
    }
    this.mousePos.set(vec2.fromValues(x, y));
  }

  setSize(w: number, h: number) {
    this.size.set(vec2.fromValues(w, h));
  }

  setUnitsPerPixel(scale: number) { this.scale.set(scale) }
  getUnitsPerPixel() { return this.scale.get() }
  setPosition(x: number, y: number, z: number): void { this.camera.setPosition(x, z, y) }
  getPosition() { return this.camera.position.get() }
  getTransformMatrix() { return this.camera.transform.get() }

  getPointerPosition(pointer: vec3) {
    const [mx, my] = this.mousePos.get();
    const [w, h] = this.size.get();
    const lx = mx - (w / 2);
    const ly = my - (h / 2);
    const [cx, cz, cy] = this.camera.position.get();
    const scale = this.scale.get();
    return vec3.set(pointer, cx + lx * scale, cz, cy + ly * scale);
  }

  getMaxDist() {
    const [w, h] = this.size.get();
    const max = Math.max(h, w);
    return (max / 2) * this.scale.get();
  }

  getProjectionMatrix() {
    return this.projection.get();
  }
}
