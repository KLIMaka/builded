import { range } from "./collections";
import { len2d, sqrLen2d } from "./mathutils";

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
    const estIdx = this.closestEstimation(pos, this.top, Number.MAX_VALUE, 0);
    const p = this.points[estIdx];
    const dsqr = sqrLen2d(p[0] - pos[0], p[1] - pos[1]);
    const d = Math.sqrt(dsqr);
    let mindsqr = dsqr;
    let minIdx = estIdx;
    for (const idx of this.inRange(pos[0] - d, pos[1] - d, pos[0] + d, pos[1] + d)) {
      const p = this.points[idx];
      const dsqr = sqrLen2d(pos[0] - p[0], pos[1] - p[1]);
      if (dsqr < mindsqr) {
        mindsqr = dsqr;
        minIdx = idx;
      }
    }
    return minIdx;
  }

  public distance(x: number, y: number, lenf = len2d): number {
    const [cx, cy] = this.points[this.closest([x, y])];
    return lenf(x - cx, y - cy);
  }

  public inRange(minx: number, miny: number, maxx: number, maxy: number): number[] {
    const result = [];
    this.rangeSearch([minx, miny], [maxx, maxy], this.top, 0, result);
    return result;
  }

  private closestEstimation(pos: [number, number], node: number, mind: number, depth: number): number {
    if (node == -1) return -1;
    const idx = this.tree[node];
    const p = this.points[idx];
    const left = this.tree[node + 1];
    const right = this.tree[node + 2];
    const d = sqrLen2d(p[0] - pos[0], p[1] - pos[1]);
    const z = depth & 1;
    const dz = pos[z] - p[z];
    const nextNode = dz <= 0 ? left : right;
    const nmind = Math.min(mind, d);
    const closest = this.closestEstimation(pos, nextNode, nmind, depth + 1);
    return closest == -1 ? idx : closest;
  }

  private rangeSearch(min: [number, number], max: [number, number], node: number, depth: number, result: number[]): void {
    if (node == -1) return;
    const idx = this.tree[node];
    const p = this.points[idx];
    const left = this.tree[node + 1];
    const right = this.tree[node + 2];
    const z = depth & 1;

    if (p[z] > min[z] && p[z] > max[z]) return this.rangeSearch(min, max, left, depth + 1, result);
    if (p[z] < min[z] && p[z] < max[z]) return this.rangeSearch(min, max, right, depth + 1, result);

    if (p[0] >= min[0] && p[1] >= min[1] && p[0] <= max[0] && p[1] <= max[1]) result.push(idx);
    this.rangeSearch(min, max, left, depth + 1, result);
    this.rangeSearch(min, max, right, depth + 1, result);
  }
}