import Optional from "optional-js";
import { filter, map, reduce, forEach, all, enumerate, take, findFirst, chain, butLast, skip, any, iterIsEmpty, skipWhile, flatten, Deiterable, zip, join, length, toMap, reduceFirst, group, toObject, groupEntries } from "./collections";
import { Function } from "./types";

export class Iter<T> implements Iterable<T> {
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
  first(f: (t: T) => boolean = _ => true): Optional<T> { return findFirst(this.iter, f) }
  chain(i: Iterable<T>): Iter<T> { return new Iter(chain(this.iter, i)) }
  butLast(): Iter<T> { return new Iter(butLast(this.iter)) }
  flatten(): Iter<Deiterable<T>> { return new Iter(flatten(this.iter)) }
  collect(): T[] { return [...this.iter] }
  set(): Set<T> { return new Set(this.iter) }
  length(): number { return length(this.iter) }
  toMap<K, V>(keyMapper: Function<T, K>, valueMapper: Function<T, V>): Map<K, V> { return toMap(this.iter, keyMapper, valueMapper) }
  toObject<U>(keyMapper: Function<T, keyof U>, valueMapper: Function<T, any>): U { return toObject(this.iter, keyMapper, valueMapper) }
  group<K, V>(keyMapper: Function<T, K>, valueMapper: Function<T, V>): Map<K, V[]> { return group(this.iter, keyMapper, valueMapper) }
  groupEntries<K, V>(keyMapper: Function<T, K>, valueMapper: Function<T, V>): Iter<[K, V[]]> { return new Iter(groupEntries(this.iter, keyMapper, valueMapper)) }
  async await_(): Promise<Iter<Awaited<T>>> { return new Iter(await Promise.all([...this.iter])) }
}

export function iter<T>(iter: Iterable<T>) {
  return Iter.of(iter);
}

