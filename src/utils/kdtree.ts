import { range } from "./collections";
import { BiFunction, MultiFunction } from "./types";

export class KDTree {
  private tree: number[] = [];
  private top: number;

  constructor(
    private points: number[],
    private dims: number,
    private distanceFn: BiFunction<number[], number[], number>,
    private inRangeFn: MultiFunction<[number[], number[], number[]], boolean>,
  ) {
    this.top = this.build([...range(0, points.length / dims)], 0);
  }

  private insertNode(pointIdx: number, left: number, right: number) {
    const idx = this.tree.length;
    this.tree.push(pointIdx, left, right);
    return idx;
  }

  private point(idx: number, dim: number): number {
    return this.points[idx * this.dims + dim];
  }

  private build(idxs: number[], depth: number): number {
    if (idxs.length === 1) return this.insertNode(idxs[0], -1, -1);
    if (idxs.length === 0) return -1;

    const dim = depth % this.dims;
    const sorted = idxs.sort((lh, rh) => this.point(lh, dim) - this.point(rh, dim));
    const mid = Math.floor(sorted.length / 2);

    return this.insertNode(idxs[mid], this.build(sorted.slice(0, mid), depth + 1), this.build(sorted.slice(mid + 1), depth + 1))
  }

  closest(pos: number[]): number {
    const estIdx = this.closestEstimation(pos, this.top, Number.MAX_VALUE, 0);
    const d = this.distanceFn(this.getPoint(estIdx), pos);
    let mind = d;
    let minIdx = estIdx;
    for (const idx of this.inRangeRadius(pos, d)) {
      const d = this.distanceFn(this.getPoint(idx), pos);
      if (d < mind) {
        mind = d;
        minIdx = idx;
      }
    }
    return minIdx;
  }

  inRange(min: number[], max: number[]): number[] {
    const result = [];
    this.rangeSearch(min, max, this.top, 0, result);
    return result;
  }

  inRangeRadius(pos: number[], r: number): number[] {
    const result = [];
    this.rangeSearch(pos.map(x => x - r), pos.map(x => x + r), this.top, 0, result);
    return result;
  }

  private getPoint(idx: number): number[] {
    return this.points.slice(idx * this.dims, idx * this.dims + this.dims);
  }

  private closestEstimation(pos: number[], node: number, mind: number, depth: number): number {
    if (node === -1) return -1;
    const idx = this.tree[node];
    const left = this.tree[node + 1];
    const right = this.tree[node + 2];
    const d = this.distanceFn(this.getPoint(idx), pos);
    const dim = depth % this.dims;
    const dd = pos[dim] - this.point(idx, dim);
    const nextNode = dd <= 0 ? left : right;
    const nmind = Math.min(mind, d);
    const closest = this.closestEstimation(pos, nextNode, nmind, depth + 1);
    return closest === -1 ? idx : closest;
  }

  private rangeSearch(min: number[], max: number[], node: number, depth: number, result: number[]): void {
    if (node === -1) return;
    const idx = this.tree[node];
    const left = this.tree[node + 1];
    const right = this.tree[node + 2];
    const dim = depth % this.dims;

    if (this.point(idx, dim) > min[dim] && this.point(idx, dim) > max[dim]) return this.rangeSearch(min, max, left, depth + 1, result);
    if (this.point(idx, dim) < min[dim] && this.point(idx, dim) < max[dim]) return this.rangeSearch(min, max, right, depth + 1, result);

    if (this.inRangeFn(this.getPoint(idx), min, max)) result.push(idx);
    this.rangeSearch(min, max, left, depth + 1, result);
    this.rangeSearch(min, max, right, depth + 1, result);
  }
}