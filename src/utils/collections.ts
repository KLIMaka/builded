import { cyclic } from "./mathutils";
import { Iter } from "./iter";

export interface Collection<T> extends Iterable<T> {
  get(i: number): T;
  length(): number;
}

export function last<T>(c: Collection<T>): T { return c.get(c.length() - 1) }
export function first<T>(c: Collection<T>): T { return c.get(0) }
export function isEmpty<T>(c: Collection<T>): boolean { return c.length() == 0 }

export interface MutableCollection<T> extends Collection<T> {
  set(idx: number, value: T): void;
}

export function ITERATOR_RESULT<T>(value: T): IteratorResult<T> { return { value, done: false } };
export const TERMINAL_ITERATOR_RESULT: IteratorResult<any> = { value: null, done: true };
export const EMPTY_ITERATOR = { next: () => TERMINAL_ITERATOR_RESULT };
export const EMPTY_COLLECTION: MutableCollection<any> = {
  get: (i: number) => undefined,
  length: () => 0,
  [Symbol.iterator]: () => EMPTY_ITERATOR,
  set: (i: number, v: any) => { }
}

export function iteratorResult<T>(isDone: boolean, val: T): IteratorResult<T> {
  return isDone ? TERMINAL_ITERATOR_RESULT : ITERATOR_RESULT(val);
}

export class ArrayWrapper<T> implements MutableCollection<T> {
  constructor(readonly array: T[], readonly size: number = array.length) { };
  get(i: number) { return this.array[i] }
  length() { return this.size }
  [Symbol.iterator]() { return this.array.values(); }
  set(i: number, value: T) { this.array[i] = value }
}
export function wrap<T>(array: T[], len: number = array.length) { return new ArrayWrapper(array, len) }

export class Deck<T> implements MutableCollection<T>{
  public array: T[] = [];
  public size = 0;

  public get(i: number) { return this.array[i] }

  public set(i: number, value: T) {
    if (i < 0 || i >= this.size) throw new Error(`Invalid set position: ${i}, size:${this.size}`);
    this.array[i] = value;
  }

  public push(value: T): Deck<T> {
    this.array[this.size++] = value;
    return this;
  }

  public pushAll(values: Iterable<T>): Deck<T> {
    for (let val of values) this.push(val);
    return this;
  }

  public pop(): Deck<T> {
    this.size--;
    return this;
  }

  public top(): T {
    return this.array[this.size - 1];
  }

  public clear(): Deck<T> {
    this.size = 0;
    return this;
  }

  public length() {
    return this.size;
  }

  public clone() {
    let copy = new Deck<T>();
    copy.array = [...take(this.array, this.size)];
    copy.size = this.size;
    return copy;
  }

  public [Symbol.iterator]() {
    let i = 0;
    return this.size == 0
      ? EMPTY_ITERATOR
      : { next: () => { return iteratorResult(i == this.size, this.array[i++]) } }
  }
}

export class IndexedDeck<T> extends Deck<T>{
  private index = new Map<T, number>();

  public push(value: T): IndexedDeck<T> {
    if (this.index.has(value)) return this;
    super.push(value);
    this.index.set(value, this.size - 1);
    return this;
  }

  public set(i: number, value: T) {
    const last = this.get(i);
    super.set(i, value);
    this.index.delete(last);
    this.index.set(value, i);
  }

  public clear(): IndexedDeck<T> {
    super.clear();
    this.index.clear();
    return this;
  }

  public indexOf(value: T) {
    let idx = this.index.get(value);
    return idx == undefined ? -1 : idx;
  }

  public hasAny(i: Iterable<T>): boolean {
    for (const v of i) if (this.indexOf(v) != -1) return true;
    return false;
  }
}

export function reverse<T>(c: Collection<T>): Collection<T> {
  return isEmpty(c)
    ? EMPTY_COLLECTION
    : {
      get: (i: number) => c.get(c.length() - 1 - i),
      length: () => c.length(),
      [Symbol.iterator]: () => reversed(c)
    }
}

export function length<T>(it: Iterable<T>): number {
  let length = 0;
  for (const _ of it) length++;
  return length;
}

export function* filter<T>(i: Iterable<T>, f: (t: T) => boolean): Generator<T> {
  for (const v of i) if (f(v)) yield v;
}

export function* map<T, V>(i: Iterable<T>, f: (t: T) => V): Generator<V> {
  for (const v of i) yield f(v);
}

export function forEach<T>(i: Iterable<T>, f: (t: T) => void): void {
  for (const v of i) f(v);
}

export function reduce<T>(i: Iterable<T>, f: (lh: T, rh: T) => T, start: T): T {
  for (const v of i) start = f(start, v);
  return start;
}

export function* sub<T>(c: Collection<T>, start: number, length: number): Generator<T> {
  for (let i = 0; i < length; i++) yield c.get(start + i);
}

export function all<T>(i: Iterable<T>, f: (t: T) => boolean): boolean {
  for (const t of i) if (!f(t)) return false;
  return true;
}

export function any<T>(i: Iterable<T>, f: (t: T) => boolean): boolean {
  for (const t of i) if (f(t)) return true;
  return false;
}

export function iterIsEmpty<T>(i: Iterable<T>): boolean {
  const ii = i[Symbol.iterator]();
  return ii.next().done;
}

export function findFirst<T>(i: Iterable<T>, f: (t: T) => boolean, def: T): T {
  for (const t of i) if (f(t)) return t;
  return def;
}

export function* chain<T>(i1: Iterable<T>, i2: Iterable<T>): Generator<T> {
  const iter1 = i1[Symbol.iterator]();
  let v = iter1.next();
  while (!v.done) {
    yield v.value;
    v = iter1.next();
  }
  const iter2 = i2[Symbol.iterator]();
  v = iter2.next();
  while (!v.done) {
    yield v.value;
    v = iter2.next();
  }
}

export function* butLast<T>(i: Iterable<T>): Generator<T> {
  const iter = i[Symbol.iterator]();
  let v1 = iter.next();
  if (v1.done) return;
  let v2 = iter.next();
  while (!v2.done) {
    yield v1.value;
    v1 = v2;
    v2 = iter.next();
  }
}

export function* reversed<T>(c: Collection<T>): Generator<T> {
  for (let i = c.length() - 1; i >= 0; i--) yield c.get(i);
}

export function* enumerate<T>(c: Iterable<T>): Generator<[T, number]> {
  let i = 0;
  for (const t of c) yield [t, i++];
}

export function* range(start: number, end: number): Generator<number> {
  const di = start > end ? -1 : 1;
  for (let i = start; i != end; i += di) yield i;
}

export function rangeIter(start: number, end: number): Iter<number> {
  return Iter.of(range(start, end));
}

export function* cyclicRange(start: number, length: number) {
  if (start >= length) throw new Error(`${start} >= ${length}`);
  for (let i = 0; i < length; i++) yield cyclic(start + i, length);
}

export function* cyclicPairs(length: number): Generator<[number, number]> {
  if (length < 0) throw new Error(`${length} < 0`)
  for (let i = 0; i < length; i++) yield [i, cyclic(i + 1, length)];
}

export function* loopPairs<T>(i: Iterable<T>): Generator<[T, T]> {
  const iter = i[Symbol.iterator]();
  const first = iter.next();
  if (first.done) return;
  let lh = first;
  let rh = iter.next();
  while (!rh.done) {
    yield [lh.value, rh.value];
    lh = rh;
    rh = iter.next();
  }
  yield [lh.value, first.value];
}

export function* pairs<T>(i: Iterable<T>): Generator<[T, T]> {
  const iter = i[Symbol.iterator]();
  const first = iter.next();
  if (first.done) return;
  let lh = first;
  let rh = iter.next();
  while (!rh.done) {
    yield [lh.value, rh.value];
    lh = rh;
    rh = iter.next();
  }
}

export function* take<T>(c: Iterable<T>, count: number): Generator<T> {
  if (count < 0) return;
  const iter = c[Symbol.iterator]();
  while (count > 0) {
    const next = iter.next();
    if (next.done) return;
    yield next.value;
    count--;
  }
}

export function skip<T>(i: Iterable<T>, count: number): Iterable<T> {
  const iter = i[Symbol.iterator]();
  while (count > 0) {
    const v = iter.next();
    if (v.done) break;
    count--;
  }
  return {
    [Symbol.iterator]: () => {
      return {
        next: () => { return iter.next() }
      }
    }
  }
}

export function skipWhile<T>(i: Iterable<T>, f: (t: T) => boolean): Iterable<T> {
  const iter = i[Symbol.iterator]();
  for (; ;) {
    const v = iter.next();
    if (v.done || !f(v.value)) break;
  }
  return {
    [Symbol.iterator]: () => {
      return {
        next: () => { return iter.next() }
      }
    }
  }
}

export function* rect(w: number, h: number): Generator<[number, number]> {
  if (w < 0) throw new Error(`${w} < 0`)
  if (h < 0) throw new Error(`${h} < 0`)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      yield [x, y]
}

export function intersect<T>(lh: Set<T>, rh: Set<T>): Set<T> {
  return new Set([...lh].filter(t => rh.has(t)));
}

export function* interpolate<T>(ii: Iterable<T>, f: (lh: T, rh: T, t: number) => T, points = [0.5]) {
  const i = ii[Symbol.iterator]();
  let lh = i.next();
  if (lh.done) return;
  yield lh.value;
  let rh = i.next();
  while (!rh.done) {
    for (const p of points) yield f(lh.value, rh.value, p);
    yield rh.value;
    lh = rh;
    rh = i.next();
  }
}

export function* flatten<T>(i: Iterable<T[]>): Generator<T> {
  const ii = i[Symbol.iterator]();
  let item = ii.next();
  while (!item.done) {
    for (const v of item.value) yield v;
    item = ii.next();
  }
}

export function or<T>(lh: T, rh: T): T {
  return lh ? lh : rh;
}