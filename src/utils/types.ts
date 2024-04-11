export type Predicate<T> = (value: T) => boolean;
export type Supplier<T> = () => T;
export type Consumer<T> = (value: T) => void;
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