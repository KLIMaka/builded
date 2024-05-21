export type Predicate<T> = (value: T) => boolean;
export type Supplier<T> = () => T;
export type Consumer<T> = (value: T) => void;
export type BiConsumer<T1, T2> = (value1: T1, value2: T2) => void;
export type Function<T, U> = (value: T) => U;
export type BiFunction<T1, T2, U> = (value1: T1, value2: T2) => U;
export type Transform<T> = Function<T, T>;

const truePredicate = (_: any) => true;
export function true_<T>(): Predicate<T> {
  return truePredicate;
}

const falsePredicate = (_: any) => false;
export function false_<T>(): Predicate<T> {
  return falsePredicate;
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

export function first<T1, T2>(tuple: [T1, T2]): T1 {
  return tuple[0]
}

export function second<T1, T2>(tuple: [T1, T2]): T2 {
  return tuple[1]
}