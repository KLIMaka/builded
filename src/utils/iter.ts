import Optional from "optional-js";
import { filter, map, reduce, forEach, all, enumerate, take, findFirst, chain, butLast, skip, any, iterIsEmpty, skipWhile, flatten, Deiterable, zip, join, length, toMap, reduceFirst } from "./collections";
import { Function } from "./types";

export class Iter<T> implements Iterable<T>{
  public static of<T>(iter: Iterable<T>) { return new Iter(iter) }

  constructor(public iter: Iterable<T>) { };
  [Symbol.iterator]() { return this.iter[Symbol.iterator]() }

  filter(f: (t: T) => boolean): Iter<T> { return new Iter(filter(this.iter, f)) }
  map<U>(f: (t: T) => U): Iter<U> { return new Iter(map(this.iter, f)) }
  zip<T1>(it: Iterable<T1>): Iter<[T, T1]> { return new Iter(zip(this.iter, it)) }
  join(separator: T): Iter<T> { return new Iter(join(this.iter, separator)) }
  forEach(f: (t: T) => void): Iter<T> { forEach(this.iter, f); return this }
  enumerate(): Iter<[T, number]> { return new Iter(enumerate(this.iter)) }
  take(count: number): Iter<T> { return new Iter(take(this.iter, count)) }
  skip(count: number): Iter<T> { return new Iter(skip(this.iter, count)) }
  skipWhile(f: (t: T) => boolean): Iter<T> { return new Iter(skipWhile(this.iter, f)) }
  reduce(f: (lh: T, rh: T) => T, start: T): T { return reduce(this.iter, f, start) }
  reduceFirst(f: (lh: T, rh: T) => T): Optional<T> { return reduceFirst(this.iter, f) }
  all(f: (t: T) => boolean): boolean { return all(this.iter, f) }
  any(f: (t: T) => boolean): boolean { return any(this.iter, f) }
  isEmpty(): boolean { return iterIsEmpty(this.iter) }
  first(f: (t: T) => boolean, def: T): T { return findFirst(this.iter, f, def) }
  chain(i: Iterable<T>): Iter<T> { return new Iter(chain(this.iter, i)) }
  butLast(): Iter<T> { return new Iter(butLast(this.iter)) }
  flatten(): Iter<Deiterable<T>> { return new Iter(flatten(this.iter)) }
  collect(): T[] { return [...this.iter] }
  set(): Set<T> { return new Set(this.iter) }
  length(): number { return length(this.iter) }
  toMap<K, V>(keyMapper: Function<T, K>, valueMapper: Function<T, V>): Map<K, V> { return toMap(this.iter, keyMapper, valueMapper) }
}

export function iter<T>(iter: Iterable<T>) {
  return Iter.of(iter);
}

