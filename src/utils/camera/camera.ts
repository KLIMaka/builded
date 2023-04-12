import { mat4, vec3 } from 'gl-matrix';
import { deg2rad } from '../mathutils';

export class Camera {
  private transform: mat4;
  private position: vec3;
  private angleX: number;
  private angleY: number;
  private needUpdate: boolean = true;

  constructor(x: number, y: number, z: number, ax: number, ay: number) {
    this.transform = mat4.create();
    this.position = vec3.fromValues(x, y, z);
    this.angleX = ax;
    this.angleY = ay;
  }

  public setPosition(x: number, y: number, z: number): void {
    vec3.set(this.position, x, y, z);
    this.needUpdate = true;
  }

  public getPosition(): vec3 {
    return this.position;
  }

  public forward(): vec3 {
    const mat4 = this.getTransformMatrix()
    return vec3.fromValues(-mat4[2], -mat4[6], -mat4[10]);
  }

  public side(): vec3 {
    const mat4 = this.getTransformMatrix()
    return vec3.fromValues(mat4[0], mat4[4], mat4[8]);
  }

  public updateAngles(dx: number, dy: number): void {
    this.angleY -= dx;
    this.angleX -= dy;
    this.angleX = Math.max(-90, Math.min(90, this.angleX));
    this.needUpdate = true;
  }

  public setAngles(ax: number, ay: number): void {
    this.angleX = Math.max(-90, Math.min(90, ax));
    this.angleY = ay;
    this.needUpdate = true;
  }

  public getTransformMatrix(): mat4 {
    const mat = this.transform;
    if (this.needUpdate) {
      var pos = this.position;
      mat4.identity(mat);
      mat4.rotateX(mat, mat, deg2rad(-this.angleX));
      mat4.rotateY(mat, mat, deg2rad(-this.angleY));
      vec3.negate(pos, pos);
      mat4.translate(mat, mat, pos);
      vec3.negate(pos, pos);
      this.needUpdate = false;
    }
    return mat;
  }
}