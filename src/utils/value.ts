import { int } from "./mathutils";

export type ParseValidator = (str: string) => boolean;
export type Parser<T> = (str: string) => T;
export type Formatter<T> = (value: T) => string;
export type Validator<T> = (value: T) => boolean;
export type ValueProvider<T> = () => T;
export type Changer<T, C> = (value: T, change: C) => T;

export function and<T>(v1: Validator<T>, v2: Validator<T>): Validator<T> { return (v: T) => v1(v) && v2(v) }
export const IntParseValidator: ParseValidator = (str: string) => !isNaN(Number.parseInt(str));
export const FloatParseValidator: ParseValidator = (str: string) => !isNaN(Number.parseFloat(str));
export const IntParser: Parser<number> = Number.parseInt;
export const FloatParser: Parser<number> = Number.parseFloat;

export const numberRangeValidator = (min: number, max: number): Validator<number> => (v: number) => v <= max && v >= min;
export const intNumberValidator: Validator<number> = (v: number) => int(v) == v;

export type BasicValue<T> = {
  parseValidator: ParseValidator,
  parser: Parser<T>,
  formatter: Formatter<T>,
  validator: Validator<T>,
  default: ValueProvider<T>
}

const NUMBER_FMT = Intl.NumberFormat('en-US', { maximumFractionDigits: 4, useGrouping: false, }).format;

export function intValue(def: number, validator: Validator<number>): BasicValue<number> {
  return { default: () => def, validator: and(intNumberValidator, validator), parseValidator: IntParseValidator, parser: IntParser, formatter: NUMBER_FMT };
}

export function floatValue(def: number, validator: Validator<number>): BasicValue<number> {
  return { default: () => def, validator: validator, parseValidator: FloatParseValidator, parser: FloatParser, formatter: NUMBER_FMT };
}