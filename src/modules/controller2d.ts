import * as GLM from '../libs_js/glmatrix';
import { Camera } from "./camera";
import { ZSCALE } from './engines/build/utils';

const ZPOS = 1024 * ZSCALE;

export class Controller2D {
  private camera = new Camera(0, 0, 0, 0, 0);
  private width = 800;
  private height = 600;
  private oldX = 0;
  private oldY = 0;
  private scale = 1;
  private projection = GLM.mat4.create();

  public track(x: number, y: number, move: boolean) {
    if (move) {
      var dx = (x - this.oldX) * this.scale;
      var dy = (y - this.oldY) * this.scale;
      let pos = this.camera.getPosition();
      this.camera.setPositionXYZ(pos[0] - dx, ZPOS, pos[2] - dy);
    }
    this.oldX = x;
    this.oldY = y;
  }

  // private mousewheel(e: WheelEvent): boolean {
  //   var dx = e.clientX - this.gl.drawingBufferWidth / 2;
  //   var dy = e.clientY - this.gl.drawingBufferHeight / 2;

  //   var k = -MU.sign(e.deltaY) / 10;
  //   this.scale *= k + 1;

  //   var campos = this.camera.getPosition();
  //   var koef = this.scale * -(k / (k + 1));
  //   var newX = campos[0] + dx * koef;
  //   var newY = campos[1] + dy * koef;
  //   this.camera.setPositionXYZ(newX, newY, 0);
  //   return false;
  // }

  public setSize(w: number, h: number) {
    this.width = w;
    this.height = h;
  }

  public getWidth() { return this.width }
  public getHeight() { return this.height }

  public setUnitsPerPixel(scale: number) {
    this.scale = scale;
  }

  public getUnitsPerPixel() {
    return this.scale;
  }

  public setPosition(x: number, y: number): void {
    this.camera.setPositionXYZ(x, ZPOS, y);
  }

  public getPointerPosition(pointer: GLM.Vec3Array, x: number, y: number) {
    let pos = this.camera.getPosition();
    return GLM.vec3.set(pointer, pos[0] + (this.width / 2) * x * this.scale, 0, pos[2] + (this.height / 2) * y * this.scale);
  }

  public getTransformMatrix() {
    return this.camera.getTransformMatrix();
  }

  public getProjectionMatrix() {
    var projection = this.projection;
    var wscale = this.width / 2 * this.scale;
    var hscale = this.height / 2 * this.scale;
    GLM.mat4.identity(projection);
    GLM.mat4.ortho(projection, -wscale, wscale, hscale, -hscale, 1, 0xFFFF);
    GLM.mat4.rotateX(projection, projection, -Math.PI / 2);
    return projection;
  }

  public getPosition() {
    return this.camera.getPosition();
  }
}
