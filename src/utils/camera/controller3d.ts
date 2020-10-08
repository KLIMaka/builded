import * as MU from '../../utils/mathutils';
import * as camera from './camera';
import { mat4, vec3, Mat4Array, Vec3Array } from '../../libs_js/glmatrix';

let invertTrans = mat4.create();
let invTP = mat4.create();
let forward = vec3.create();

export class Controller3D {
  private camera = new camera.Camera(0, 0, 0, 0, 0);
  private projection = mat4.create();
  private fov = 90;
  private oldX = 0;
  private oldY = 0;

  public setFov(fov: number) {
    this.fov = fov;
  }

  public getFov(): number {
    return this.fov;
  }

  public getMatrix(aspect: number): Mat4Array {
    let projection = this.getProjectionMatrix(aspect);
    mat4.mul(projection, projection, this.camera.getTransformMatrix());
    return projection;
  }

  public getProjectionMatrix(aspect: number): Mat4Array {
    return mat4.perspective(this.projection, MU.deg2rad(this.fov), aspect, 1, 0xFFFF);
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

  public getForwardUnprojected(aspect: number, x: number, y: number): Vec3Array {
    mat4.invert(invertTrans, this.getTransformMatrix());
    mat4.invert(invTP, this.getProjectionMatrix(aspect));
    mat4.mul(invTP, invertTrans, invTP);

    vec3.set(forward, x, -y, -1);
    vec3.transformMat4(forward, forward, invTP);
    vec3.sub(forward, forward, this.getPosition());
    return vec3.normalize(forward, forward);
  }

  public moveForward(dist: number) {
    let forward = this.camera.forward();
    let campos = this.camera.getPosition();
    vec3.scale(forward, forward, dist);
    vec3.add(campos, campos, forward);
    this.camera.setPosition(campos[0], campos[1], campos[2]);
  }

  public moveSideway(dist: number) {
    let sideways = this.camera.side();
    let campos = this.camera.getPosition();
    vec3.scale(sideways, sideways, dist);
    vec3.add(campos, campos, sideways);
    this.camera.setPosition(campos[0], campos[1], campos[2]);
  }

  public track(x: number, y: number, move: boolean) {
    if (move) this.camera.updateAngles((x - this.oldX) / 2, (y - this.oldY) / 2);
    this.oldX = x;
    this.oldY = y;
  }
}