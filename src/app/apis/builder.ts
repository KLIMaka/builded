import { DrawCallConsumer, HintRenderable, Renderable, RenderableConsumer, RenderableProvider } from "./renderable";

export interface Builder extends RenderableProvider<HintRenderable> {
  reset(): void;
  get(): Renderable;
  needToRebuild(): void;
}

export class Builders implements Builder, RenderableProvider<HintRenderable> {
  constructor(builders: Iterable<Builder>, private copy = [...builders]) { }
  get() { return this }
  reset() { let size = this.copy.length - 1; while (size >= 0) this.copy[size--].reset() }
  draw(consumer: DrawCallConsumer) { let size = this.copy.length - 1; while (size >= 0) this.copy[size--].get().draw(consumer) }
  accept(consumer: RenderableConsumer<HintRenderable>): void { let size = this.copy.length - 1; while (size >= 0) this.copy[size--].accept(consumer) }
  needToRebuild() { let size = this.copy.length - 1; while (size >= 0) this.copy[size--].needToRebuild() }
}