import Optional from "optional-js";
import { cyclic } from "./mathutils";
import { Function, Supplier } from "./types";
import { Disposable } from "./callbacks";
import { iter } from "./iter";

export class LazyValue<T> {
  private initialized = false;
  private value: T;

  constructor(
    private initializer: Supplier<T>
  ) { }

  get(): T {
    if (!this.initialized) {
      this.value = this.initializer();
      this.initialized = true;
    }
    return this.value;
  }
}

export class Toggler<T> {
  constructor(
    private onValue: T,
    private offValue: T,
    private value = false) { }

  toggle(): void { this.value = !this.value }
  get(): T { return this.value ? this.onValue : this.offValue }
  set(value: boolean): void { this.value = value }
}

export function toggler<T>(onValue: T, offValue: T, value = false) {
  return new Toggler(onValue, offValue, value);
}

export class CyclicToggler<T> {
  constructor(
    private values: T[],
    private index = 0
  ) { }

  toggleNext(): T { this.index = cyclic(this.index + 1, this.values.length); return this.get() }
  togglePrev(): T { this.index = cyclic(this.index - 1, this.values.length); return this.get() }
  get(): T { return this.values[this.index] }

  set(value: T): T {
    const idx = this.values.indexOf(value);
    if (idx !== -1) this.index = idx;
    return value;
  }
}

export function cyclicToggler<T>(values: T[], currentValue: T) {
  const toggler = new CyclicToggler(values);
  toggler.set(currentValue);
  return toggler;
}

export function promisify<T>(f: Supplier<T>): Supplier<Promise<T>> {
  return async () => f();
}

export function firstNot<T>(t1: T, t2: T, ref: T): Optional<T> {
  return t1 !== ref ? Optional.of(t1) : t2 !== ref ? Optional.of(t2) : Optional.empty();
}

export function firstNotNull<T>(t1: T, t2: T): Optional<T> {
  return firstNot(t1, t2, null);
}

export function objectKeys<T>(obj: T): (keyof T)[] {
  return Object.keys(obj) as (keyof T)[];
}

export function applyDefaults<T>(value: T, def: T) {
  return { ...def, ...value };
}

export function field<T, K extends keyof T>(field: K): Function<T, T[K]> {
  return x => x[field];
}

type Optionalify<T> = { [P in keyof T]: Optional<T[P]> };
export function andOptional<T extends any[]>(...opts: Optionalify<T>): Optional<T> {
  if (opts.find(o => !o.isPresent()) !== undefined) return Optional.empty();
  return Optional.of(opts.map(o => o.get()) as T)
}

export async function asyncMapOptional<T, U>(src: Optional<T>, mapper: Function<T, Promise<U>>): Promise<Optional<U>> {
  if (!src.isPresent()) return Optional.empty();
  return Optional.of(await mapper(src.get()));
}

export function zipOptional<T, U>(l: Optional<T>, r: Optional<U>): Optional<[T, U]> {
  return l.flatMap(l => r.map(r => [l, r]));
}

export async function asyncFlatMapOptional<T, U>(src: Optional<T>, mapper: Function<T, Promise<Optional<U>>>): Promise<Optional<U>> {
  if (!src.isPresent()) return Optional.empty();
  return await mapper(src.get());
}

export function strcmpci(str1: string, str2: string) {
  return str1.toLowerCase() === str2.toLowerCase();
}

export function checkNotNull<T>(value: T, message: string): T {
  if (value === null) throw new Error(message);
  return value;
}

export type Id = { value: number } & Disposable;
export class UniqueIds {
  private ids = new Set<number>();

  private getEmpty(): number {
    if (this.ids.size === 0) return 0;
    let id = 0;
    for (; ;) {
      const currentId = id;
      if (!iter(this.ids.values()).first(id => id === currentId).isPresent()) return currentId;
      id++;
    }
  }

  get(): Id {
    const value = this.getEmpty();
    this.ids.add(value);
    const dispose = async () => { this.ids.delete(value) }
    return { value, dispose }
  }
}