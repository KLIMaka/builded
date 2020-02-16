import { len2d } from "../../../../libs/mathutils";
import { vec3, Vec3Array } from "../../../../libs_js/glmatrix";
import { Ray } from "../hitscan";
import { Mover } from "./messages";

export class MovingHandle implements Mover {
  private startPoint = vec3.create();
  private currentPoint = vec3.create();
  private dzoff = 0;
  private active = false;
  private vertical = false;
  private parallel = false;

  public start(pos: Vec3Array) {
    vec3.copy(this.startPoint, pos);
    vec3.copy(this.currentPoint, this.startPoint);
    this.dzoff = 0;
    this.active = true;
  }

  public update(vertical: boolean, parallel: boolean, start: Vec3Array, dir: Vec3Array) {
    this.parallel = parallel;
    this.vertical = vertical;
    if (vertical) {
      let dx = this.currentPoint[0] - start[0];
      let dy = this.currentPoint[2] - start[2];
      let t = len2d(dx, dy) / len2d(dir[0], dir[2]);
      this.dzoff = dir[1] * t + start[1] - this.currentPoint[1];
    } else {
      this.dzoff = 0;
      let dz = this.startPoint[1] - start[1];
      let t = dz / dir[1];
      vec3.copy(this.currentPoint, dir);
      vec3.scale(this.currentPoint, this.currentPoint, t);
      vec3.add(this.currentPoint, this.currentPoint, start);
    }
  }

  public isActive() { return this.active; }
  public stop() { this.active = false; }
  public get dx() { return this.parallel && Math.abs(this.dx_()) < Math.abs(this.dy_()) ? 0 : this.dx_(); }
  public get dy() { return this.parallel && Math.abs(this.dy_()) < Math.abs(this.dx_()) ? 0 : this.dy_(); }
  public get dz() { return this.vertical ? this.currentPoint[1] - this.startPoint[1] + this.dzoff : 0; }
  private dx_() { return this.currentPoint[0] - this.startPoint[0]; }
  private dy_() { return this.currentPoint[2] - this.startPoint[2]; }
}
