import { State } from "../../utils/gl/stategl";
import { HintRenderable, Renderable, RenderableConsumer, RenderableProvider } from "./renderable";

export interface Builder extends RenderableProvider<HintRenderable> {
  reset(): void;
  get(): Renderable;
  needToRebuild(): void;
}

export class Builders implements Builder, RenderableProvider<HintRenderable> {
  constructor(builders: Iterable<Builder>, private copy = [...builders]) { }
  get() { return this }
  reset() { let size = this.copy.length - 1; while (size >= 0) this.copy[size--].reset() }
  draw(gl: WebGLRenderingContext, state: State) { let size = this.copy.length - 1; while (size >= 0) this.copy[size--].get().draw(gl, state) }
  accept(consumer: RenderableConsumer<HintRenderable>): void { let size = this.copy.length - 1; while (size >= 0) this.copy[size--].accept(consumer) }
  needToRebuild() { let size = this.copy.length - 1; while (size >= 0) this.copy[size--].needToRebuild() }
}