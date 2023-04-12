import { Camera } from "./camera";
import { mat4, vec3 } from "gl-matrix";

export class Controller2D {
  private camera = new Camera(0, 0, 0, 0, 0);
  private width = 0;
  private height = 0;
  private oldX = 0;
  private oldY = 0;
  private scale = 1;
  private projection = mat4.create();

  public track(x: number, y: number, z: number, move: boolean) {
    if (move) {
      const dx = (x - this.oldX) * this.scale;
      const dy = (y - this.oldY) * this.scale;
      const pos = this.camera.getPosition();
      this.camera.setPosition(pos[0] - dx, z, pos[2] - dy);
    }
    this.oldX = x;
    this.oldY = y;
  }

  public setSize(w: number, h: number) {
    this.width = w;
    this.height = h;
  }

  public getWidth() { return this.width }
  public getHeight() { return this.height }
  public setUnitsPerPixel(scale: number) { this.scale = scale }
  public getUnitsPerPixel() { return this.scale }
  public setPosition(x: number, y: number, z: number): void { this.camera.setPosition(x, z, y) }
  public getPosition() { return this.camera.getPosition() }
  public getTransformMatrix() { return this.camera.getTransformMatrix() }

  public getPointerPosition(pointer: vec3) {
    const lx = this.oldX - (this.width / 2);
    const ly = this.oldY - (this.height / 2);
    const [cx, cz, cy] = this.camera.getPosition();
    return vec3.set(pointer, cx + lx * this.scale, cz, cy + ly * this.scale);
  }

  public getMaxDist() {
    const max = Math.max(this.height, this.width);
    return (max / 2) * this.scale;
  }

  public getProjectionMatrix() {
    const projection = this.projection;
    const wscale = this.width / 2 * this.scale;
    const hscale = this.height / 2 * this.scale;
    mat4.identity(projection);
    mat4.ortho(projection, -wscale, wscale, hscale, -hscale, 1, 0xFFFF);
    mat4.rotateX(projection, projection, -Math.PI / 2);
    return projection;
  }

}
