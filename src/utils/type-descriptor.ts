
export type Validator<T> = (v: T) => boolean;
export type Parser<T> = (str: string) => T;
export type Formatter<T> = (v: T) => string;
export type ValueProvider<T> = () => T;

export interface TypeDescriptor<T> {
  readonly validator: Validator<T>;
  readonly defaultValue: ValueProvider<T>;
  readonly formatter: Formatter<T>;
  readonly parser: Parser<T>;
}

export interface EnumTypeDescriptor<T> extends TypeDescriptor<T> {
  readonly values: ValueProvider<T[]>;
}

export type Transformer<T> = (v: T) => T;
export type Comparator<T> = (lh: T, rh: T) => number;

export interface Range<T> {
  readonly min: ValueProvider<T>;
  readonly max: ValueProvider<T>;
}

export interface Order<T> {
  readonly next: Transformer<T>;
  readonly prev: Transformer<T>;
  readonly cmp: Comparator<T>;
}

export type Searcher<T> = (str: string) => T[];