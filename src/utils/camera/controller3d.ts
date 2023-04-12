import { deg2rad } from 'utils/mathutils';
import { Camera } from './camera';
import { mat4, vec3 } from 'gl-matrix';

let invertTrans = mat4.create();
let invTP = mat4.create();
let forward = vec3.create();

export class Controller3D {
  private camera = new Camera(0, 0, 0, 0, 0);
  private projection = mat4.create();
  private fovRad: number;
  private oldX = 0;
  private oldY = 0;
  private width: number;
  private height: number;
  private aspect: number;

  public setFov(fov: number) {
    this.fovRad = deg2rad(fov);
  }

  setSize(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.aspect = w / h;
  }

  public getProjectionMatrix(): mat4 {
    return mat4.perspective(this.projection, this.fovRad, this.aspect, 1, null);
  }

  public getTransformMatrix() {
    return this.camera.getTransformMatrix();
  }

  public getPosition() {
    return this.camera.getPosition();
  }

  public setPosition(x: number, y: number, z: number) {
    this.camera.setPosition(x, y, z);
  }

  public getForward() {
    return this.camera.forward();
  }

  public getForwardUnprojected(): vec3 {
    const x = (this.oldX / this.width) * 2 - 1;
    const y = (this.oldY / this.height) * 2 - 1;
    mat4.invert(invertTrans, this.getTransformMatrix());
    mat4.invert(invTP, this.getProjectionMatrix());
    mat4.mul(invTP, invertTrans, invTP);

    vec3.set(forward, x, -y, -1);
    vec3.transformMat4(forward, forward, invTP);
    vec3.sub(forward, forward, this.getPosition());
    return vec3.normalize(forward, forward);
  }

  public moveForward(dist: number) {
    const forward = this.camera.forward();
    const campos = this.camera.getPosition();
    vec3.scale(forward, forward, dist);
    vec3.add(campos, campos, forward);
    this.camera.setPosition(campos[0], campos[1], campos[2]);
  }

  public moveSideway(dist: number) {
    const sideways = this.camera.side();
    const campos = this.camera.getPosition();
    vec3.scale(sideways, sideways, dist);
    vec3.add(campos, campos, sideways);
    this.camera.setPosition(campos[0], campos[1], campos[2]);
  }

  public track(x: number, y: number, move: boolean) {
    if (move) this.camera.updateAngles((x - this.oldX) / 2, (y - this.oldY) / 2);
    this.oldX = x;
    this.oldY = y;
  }

  public getCamera(): Camera {
    return this.camera;
  }
}