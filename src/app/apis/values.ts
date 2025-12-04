import { Source, ValuesContainer } from "ts-utils/callbacks";
import { Dependency } from "ts-utils/injector";

export type Values = Readonly<{
  root: Source<ValuesContainer[]>,
  create(name: string, parent?: ValuesContainer): ValuesContainer;
}>

export const VALUES = new Dependency<Values>('Values');