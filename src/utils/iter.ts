import { filter, map, reduce, forEach, all, enumerate, take, findFirst, chain, butLast, skip, any, iterIsEmpty, skipWhile, flatten, Deiterable } from "./collections";

export class Iter<T> implements Iterable<T>{
  public static of<T>(iter: Iterable<T>) { return new Iter(iter) }

  constructor(public iter: Iterable<T>) { };
  [Symbol.iterator]() { return this.iter[Symbol.iterator]() }

  filter(f: (t: T) => boolean): Iter<T> { return new Iter(filter(this.iter, f)) }
  map<U>(f: (t: T) => U): Iter<U> { return new Iter(map(this.iter, f)) }
  forEach(f: (t: T) => void): Iter<T> { forEach(this.iter, f); return this }
  enumerate(): Iter<[T, number]> { return new Iter(enumerate(this.iter)) }
  take(count: number): Iter<T> { return new Iter(take(this.iter, count)) }
  skip(count: number): Iter<T> { return new Iter(skip(this.iter, count)) }
  skipWhile(f: (t: T) => boolean): Iter<T> { return new Iter(skipWhile(this.iter, f)) }
  reduce(f: (lh: T, rh: T) => T, start: T): T { return reduce(this.iter, f, start) }
  all(f: (t: T) => boolean): boolean { return all(this.iter, f) }
  any(f: (t: T) => boolean): boolean { return any(this.iter, f) }
  isEmpty(): boolean { return iterIsEmpty(this.iter) }
  first(f: (t: T) => boolean, def: T): T { return findFirst(this.iter, f, def) }
  chain(i: Iterable<T>): Iter<T> { return new Iter(chain(this.iter, i)) }
  butLast(): Iter<T> { return new Iter(butLast(this.iter)) }
  flatten(): Iter<Deiterable<T>> { return new Iter(flatten(this.iter)) }
  collect(): T[] { return [...this.iter] }
  set(): Set<T> { return new Set(this.iter) }
}

export function iter<T>(iter: Iterable<T>) {
  return Iter.of(iter);
}

