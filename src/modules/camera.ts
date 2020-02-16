import * as GLM from './../libs_js/glmatrix';
import * as MU from './../libs/mathutils';

export class Camera {
  private transform:GLM.Mat4Array;
  private position:GLM.Vec3Array;
  private angleX:number;
  private angleY:number;
  private needUpdate:boolean = true;

  constructor(x:number, y:number, z:number, ax:number, ay:number) {
    this.transform = GLM.mat4.create();
    this.position = GLM.vec3.fromValues(x, y, z);
    this.angleX = ax;
    this.angleY = ay;
  }

  public setPosition(pos:GLM.Vec3Array):void {
    this.position = pos;
    this.needUpdate = true;
  }

  public setPositionXYZ(x:number, y:number, z:number):void {
    GLM.vec3.set(this.position, x, y, z);
    this.needUpdate = true;
  }

  public getPosition():GLM.Vec3Array {
    return this.position;
  }

  public forward():GLM.Vec3Array {
    var mat4 = this.getTransformMatrix()
    return GLM.vec3.fromValues(-mat4[2], -mat4[6], -mat4[10]);
  }

  public side():GLM.Vec3Array {
    var mat4 = this.getTransformMatrix()
    return GLM.vec3.fromValues(mat4[0], mat4[4], mat4[8]);
  }

  public updateAngles(dx:number, dy:number):void {
    this.angleY -= dx;
    this.angleX -= dy;
    this.angleX = Math.max(-90, Math.min(90, this.angleX));
    this.needUpdate = true;
  }

  public setAngles(ax:number, ay:number):void {
    this.angleX = Math.max(-90, Math.min(90, ax));
    this.angleY = ay;
    this.needUpdate = true;
  }

  public getTransformMatrix():GLM.Mat4Array {
    var mat = this.transform;
    if (this.needUpdate) {
      var pos = this.position;
      GLM.mat4.identity(mat);
      GLM.mat4.rotateX(mat, mat, MU.deg2rad(-this.angleX));
      GLM.mat4.rotateY(mat, mat, MU.deg2rad(-this.angleY));
      GLM.vec3.negate(pos, pos);
      GLM.mat4.translate(mat, mat, pos);
      GLM.vec3.negate(pos, pos);
      this.needUpdate = false;
    }
    return mat;
  }
}