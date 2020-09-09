import { DrawCallConsumer, Renderable, } from "./renderable";

export interface Builder extends Renderable {
  reset(): void;
  get(): Renderable;
  needToRebuild(): void;
}

export class Builders implements Builder {
  constructor(builders: Iterable<Builder>, private copy = [...builders]) { }
  get() { return this }
  reset() { let size = this.copy.length - 1; while (size >= 0) this.copy[size--].reset() }
  drawCall(consumer: DrawCallConsumer) { let size = this.copy.length - 1; while (size >= 0) this.copy[size--].get().drawCall(consumer) }
  needToRebuild() { let size = this.copy.length - 1; while (size >= 0) this.copy[size--].needToRebuild() }
}