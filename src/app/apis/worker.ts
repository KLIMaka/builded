import { Source, ValuesContainer } from "ts-utils/callbacks";
import { Dependency } from "ts-utils/injector";

export type Worker = Readonly<{
  call(): Promise<void>,
}>

export const WORKER = new Dependency<Worker>('Worker');