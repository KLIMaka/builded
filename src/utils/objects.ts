import Optional from "optional-js";
import { cyclic } from "./mathutils";
import { Function, Supplier } from "./types";

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

export function applyDefaults<T>(value: T, def: T) {
  return { ...def, ...value };
}

type Optionalify<T> = { [P in keyof T]: Optional<T[P]> };
export function andOptional<T extends any[]>(...opts: Optionalify<T>): Optional<T> {
  if (opts.find(o => !o.isPresent()) !== undefined) return Optional.empty();
  return Optional.of(opts.map(o => o.get()) as T)
}

export async function asyncFlatMapOptional<T, U>(src: Optional<T>, mapper: Function<T, Promise<Optional<U>>>): Promise<Optional<U>> {
  if (!src.isPresent()) return Optional.empty();
  return await mapper(src.get());
}