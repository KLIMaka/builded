import { FastList } from "./list";
import { Collection } from "./collections";

export type Interpolator<T> = (lh: T, rh: T, t: number) => T;

export const NumberInterpolator = (lh: number, rh: number, t: number) => { return lh + (rh - lh) * t; }

export const Vec3Interpolator = (lh: number[], rh: number[], t: number) => {
  return [
    lh[0] + (rh[0] - lh[0]) * t,
    lh[1] + (rh[1] - lh[1]) * t,
    lh[2] + (rh[2] - lh[2]) * t
  ]
}

export const Vec4Interpolator = (lh: number[], rh: number[], t: number) => {
  return [
    lh[0] + (rh[0] - lh[0]) * t,
    lh[1] + (rh[1] - lh[1]) * t,
    lh[2] + (rh[2] - lh[2]) * t,
    lh[3] + (rh[3] - lh[3]) * t
  ]
}

export class Point<T> {
  constructor(public val: T, public pos: number, public interpolator: Interpolator<T>) { }
}

export type Comparator<T> = (lh: T, rh: T) => number;
export function PointComparator<T>(lh: Point<T>, rh: Point<T>) { return lh.pos - rh.pos }

export class Range<T> {
  private points = new FastList<Point<T>>();

  constructor(start: T, end: T, interpolator: Interpolator<T>) {
    this.points.push(new Point<T>(start, 0, interpolator));
    this.points.push(new Point<T>(end, 1, null));
  }

  public insert(val: T, t: number, interpolator: Interpolator<T>): void {
    let idx = binaryIndexOf1(this.points, new Point<T>(null, t, null), PointComparator);
    this.points.insertAfter(new Point<T>(val, t, interpolator), idx);
  }

  public get(t: number): T {
    if (t < 0) return this.points.get(this.points.next(0)).val;
    if (t > 1) return this.points.get(this.points.last(0)).val;
    let idx = binaryIndexOf1(this.points, new Point<T>(null, t, null), PointComparator);
    let lh = this.points.get(idx);
    let rh = this.points.get(this.points.next(idx));
    let localT = (t - lh.pos) / (rh.pos - lh.pos);
    return lh.interpolator(lh.val, rh.val, localT);
  }
}

function advance(iter: number, list: FastList<any>, steps: number) {
  for (let i = 0; i < steps; i++) iter = list.next(iter)
  return iter;
}

function length(list: FastList<any>) {
  let length = 0;
  for (let i = 0; i != list.last(0); i = list.next(i)) length++;
  return length;
}

export function binaryIndexOf1<T>(list: FastList<T>, searchElement: T, cmp: Comparator<T>) {
  let refMin = list.next(0);
  let min = list.next(0);
  let max = list.last(0);
  if (cmp(searchElement, list.get(min)) < 0 || cmp(searchElement, list.get(max)) > 0)
    return -1;
  let current = min;
  let currentElement: T = null;
  while (min != max) {
    current = advance(min, list, length(list) / 2 | 0);
    currentElement = list.get(current);
    let cmpVal = cmp(currentElement, searchElement);
    if (cmpVal < 0) min = list.next(current);
    else if (cmpVal > 0) max = list.last(current);
    else break;
  }
  return current == refMin ? refMin : current - 1;
}

export function binaryIndexOf<T>(arr: Collection<T>, searchElement: T, cmp: Comparator<T>, minIndex: number = 0, maxIndex: number = arr.length() - 1) {
  let refMinIndex = minIndex;
  if (cmp(searchElement, arr.get(minIndex)) < 0 || cmp(searchElement, arr.get(maxIndex)) > 0)
    return -1;
  let currentIndex = 0;
  let currentElement: T = null;
  while (minIndex <= maxIndex) {
    currentIndex = (minIndex + maxIndex) / 2 | 0;
    currentElement = arr.get(currentIndex);
    let cmpVal = cmp(currentElement, searchElement);
    if (cmpVal < 0) minIndex = currentIndex + 1;
    else if (cmpVal > 0) maxIndex = currentIndex - 1;
    else break;
  }
  return currentIndex == refMinIndex ? refMinIndex : currentIndex - 1;
}