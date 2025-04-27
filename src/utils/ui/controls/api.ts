import { CallbackChannel, Destination, Source } from "../../callbacks";

export type Oracle<T> = (s: string) => Iterable<T>;
export type Handle<T> = Source<T> & Destination<T> & CallbackChannel<[T]>;
export type Validator<T> = (value: T) => boolean;

export function setter<T>(setter: (v: T) => void, validator: Validator<T>) {
  return (v: T) => { if (validator(v)) setter(v) }
}