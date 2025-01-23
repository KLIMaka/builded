import Optional from "optional-js";

export type MultiFunction<Args extends any[], Res> = (...args: Args) => Res;
export type Function<T, U> = MultiFunction<[T], U>;
export type BiFunction<T1, T2, U> = MultiFunction<[T1, T2], U>;
export type Predicate<T> = Function<T, boolean>;
export type BiPredicate<T1, T2> = MultiFunction<[T1, T2], boolean>;
export type Supplier<T> = Function<void, T>;
export type MultiConsumer<Args extends any[]> = MultiFunction<Args, void>;
export type Consumer<T> = MultiConsumer<[T]>;
export type BiConsumer<T1, T2> = MultiConsumer<[T1, T2]>;
export type Transform<T> = Function<T, T>;
export type SingleTuple<T> = T extends [infer Item] ? Item : T;
export type First<T> = T extends [infer First, ...any] ? First : never;
export type Second<T> = T extends [any, infer Second, ...any] ? Second : never;
export type Rest<T> = T extends [any, ...infer Rest] ? Rest : never;
export type Last<T> = T extends [...any, infer Last] ? Last : never;
export type Iter<N extends number, IT extends any[] = []> = Length<IT> extends N ? IT : Iter<N, [any, ...IT]>;
export type Next<IT extends any[]> = [any, ...IT];
export type Prev<IT extends any[]> = IT extends readonly [any, ...infer Tail] ? Tail : [];
export type Length<IT extends readonly any[]> = IT['length'];
export type Take<T extends readonly any[], IT extends any[], O extends any[] = []> = Length<IT> extends 0 ? O : T extends readonly [infer Head, ...infer Tail] ? Take<Tail, Prev<IT>, [...O, Head]> : O;
export type Get<T extends readonly any[], N extends number> = Last<Take<T, Iter<N>>>;
export type Padd<T extends readonly any[], N extends number> = [...Iter<N>, ...T];
export type PaddRight<T extends readonly any[], N extends number> = [...T, ...Iter<N>];
export type TypedArray = Int8Array | Uint8Array | Int16Array | Uint16Array | Int32Array | Uint32Array | Uint8ClampedArray | Float32Array | Float64Array;


export interface Result<T, E extends Error = Error> {
  onErr(consumer: Consumer<E>): this;
  onOk(consumer: Consumer<T>): this;
  isOk(): boolean;
  isErr(): boolean;
  getOk(): T;
  getErr(): E;
  unwrap(): T;
  map<U>(consumer: Function<T, U>): Result<U, E>;
  mapFlat<U>(consumer: Function<T, Result<U, E>>): Result<U, E>;
  mapAsync<U>(consumer: Function<T, Promise<U>>): Promise<Result<U, E>>;
  mapFlatAsync<U>(consumer: Function<T, Promise<Result<U, E>>>): Promise<Result<U, E>>;
  optional(): Optional<T>;
}

export class Err<E extends Error> implements Result<any, E> {
  constructor(private error: E) { }
  onErr(consumer: Consumer<E>): this { consumer(this.error); return this }
  onOk(_: Consumer<any>): this { return this }
  unwrap(): any { throw this.error }
  isOk(): boolean { return false }
  isErr(): boolean { return true }
  getOk(): any { throw this.error }
  getErr(): E { return this.error }
  map(_: Function<any, any>): Result<any, E> { return this }
  mapFlat(_: Function<any, Result<any, E>>): Result<any, E> { return this }
  async mapAsync(_: Function<any, Promise<any>>): Promise<Result<any, E>> { return this }
  async mapFlatAsync(_: Function<any, Promise<Result<any, E>>>): Promise<Result<any, E>> { return this }
  optional(): Optional<any> { return Optional.empty() }
}

export class Ok<T> implements Result<T> {
  constructor(private ok: T) { }
  onErr(_: Consumer<Error>): this { return this }
  onOk(consumer: Consumer<T>): this { consumer(this.ok); return this }
  unwrap(): T { return this.ok }
  isOk(): boolean { return true }
  isErr(): boolean { return false }
  getOk(): any { return this.ok }
  getErr(): Error { throw new Error(`Result is Ok`) }
  map<U>(consumer: Function<T, U>): Result<U> { return new Ok(consumer(this.ok)) }
  mapFlat<U>(consumer: Function<T, Result<U>>): Result<U> { return consumer(this.ok) }
  async mapAsync<U>(consumer: Function<T, Promise<U>>): Promise<Result<U>> { return new Ok(await consumer(this.ok)) }
  async mapFlatAsync<U>(consumer: Function<T, Promise<Result<U>>>): Promise<Result<U>> { return await consumer(this.ok) }
  optional(): Optional<T> { return Optional.of(this.ok) }
}

export function toResult<T>(opt: Optional<T>): Result<T> {
  try { return new Ok<T>(opt.get()) }
  catch (e) { return new Err(e) }
}

export function result<T>(supplier: Supplier<T>): Result<T> {
  try {
    return new Ok(supplier());
  } catch (e) {
    return new Err(e);
  }
}

export async function resultAsync<T>(supplier: Supplier<Promise<T>>): Promise<Result<T>> {
  try {
    return new Ok(await supplier());
  } catch (e) {
    return new Err(e);
  }
}

export async function unwrapOptionalPromise<T>(opt: Optional<Promise<T>>): Promise<Optional<T>> {
  return !opt.isPresent() ? Optional.empty() : Optional.of(await opt.get());
}

const truePredicate = (_: any) => true;
export function true_<T>(): Predicate<T> {
  return truePredicate;
}

const falsePredicate = (_: any) => false;
export function false_<T>(): Predicate<T> {
  return falsePredicate;
}

export function not<T>(pred: Predicate<T>): Predicate<T> {
  return (args: T) => !pred(args);
}

const nilConsumer = (v: any) => { };
export function nil<T>(): Consumer<T> {
  return nilConsumer;
}

const identityTransformer = (x: any) => x
export function identity<T>(): Transform<T> {
  return identityTransformer;
}

export function seq(...acts: Consumer<void>[]): Consumer<void> {
  return () => { acts.forEach(a => a?.()) }
}

export function first<T extends any[]>(tuple: T): First<T> {
  return tuple[0]
}

export function second<T extends any[]>(tuple: T): Second<T> {
  return tuple[1]
}

export function pair<T, U>(t: T, u: U): [T, U] {
  return [t, u];
}

export interface Union<T, U> {
  get(): T | U;
  left(): T;
  right(): U;
  isLeft(): boolean;
}

export function left<T, U>(value: T): Union<T, U> {
  return { get: () => value, isLeft: () => true, left: () => value, right: () => { throw new Error() } }
}

export function right<T, U>(value: U): Union<T, U> {
  return { get: () => value, isLeft: () => false, left: () => { throw new Error() }, right: () => value }
}