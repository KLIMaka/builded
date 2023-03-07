import { vec3 } from "gl-matrix";
import { len2d } from "../../utils/mathutils";

export class MovingHandle {
  private startPoint = vec3.create();
  private currentPoint = vec3.create();
  private dzoff = 0;
  private active = false;
  private vertical = false;
  private parallel = false;

  public start(pos: vec3) {
    vec3.copy(this.startPoint, pos);
    vec3.copy(this.currentPoint, this.startPoint);
    this.dzoff = 0;
    this.active = true;
  }

  public update(vertical: boolean, parallel: boolean, start: vec3, dir: vec3) {
    this.parallel = parallel;
    this.vertical = vertical;
    if (vertical) {
      const dx = this.currentPoint[0] - start[0];
      const dy = this.currentPoint[2] - start[2];
      const t = len2d(dx, dy) / len2d(dir[0], dir[2]);
      this.dzoff = dir[1] * t + start[1] - this.currentPoint[1];
    } else {
      this.dzoff = 0;
      const dz = this.startPoint[1] - start[1];
      const t = dz / dir[1];
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
