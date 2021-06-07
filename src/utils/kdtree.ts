import { range } from "./collections";
import { sqrLen2d } from "./mathutils";

export class KDTree {
  private tree: number[] = [];
  private top: number;

  constructor(private points: [number, number][]) {
    this.top = this.build([...range(0, points.length)], 0);
  }

  private insertNode(pointIdx: number, left: number, right: number) {
    const idx = this.tree.length;
    this.tree.push(pointIdx, left, right);
    return idx;
  }

  private build(idxs: number[], depth: number): number {
    if (idxs.length == 1) return this.insertNode(idxs[0], -1, -1);
    if (idxs.length == 0) return -1;

    const z = depth & 1;
    const sorted = idxs.sort((lh, rh) => this.points[lh][z] - this.points[rh][z]);
    const mid = Math.floor(sorted.length / 2);

    return this.insertNode(idxs[mid], this.build(sorted.slice(0, mid), depth + 1), this.build(sorted.slice(mid + 1), depth + 1))
  }

  public closest(pos: [number, number]): number {
    const closestNode = this.findClosest(pos, this.top, Number.MAX_VALUE, 0);
    return this.tree[closestNode];
  }

  private findClosest(pos: [number, number], node: number, mind: number, depth: number): number {
    const p = this.points[this.tree[node]];
    const left = this.tree[node + 1];
    const right = this.tree[node + 2];
    const d = sqrLen2d(p[0] - pos[0], p[1] - pos[1]);
    if (left == -1 && right == -1) return d < mind ? node : -1;
    const z = depth & 1;
    const dz = pos[z] - p[z];
    const nextNode = dz <= 0 ? left : right;
    if (nextNode == -1) return d < mind ? node : -1;
    const nmind = Math.min(mind, d);
    const closest = this.findClosest(pos, nextNode, nmind, depth + 1);
    if (closest != -1) return closest;
    const nextNextNode = nextNode == right ? left : right;
    if (nextNextNode != -1 && Math.abs(dz) < Math.sqrt(d)) {
      const closest = this.findClosest(pos, nextNextNode, nmind, depth + 1);
      if (closest != -1) return closest;
    }
    return d < mind ? node : -1;
  }
}