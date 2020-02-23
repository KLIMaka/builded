import { State } from "../../utils/gl/stategl";
import { HintRenderable, Renderable, RenderableConsumer, RenderableProvider } from "./renderable";

export interface Builder extends RenderableProvider<HintRenderable> {
  reset(): void;
  get(): Renderable;
  needToRebuild(): void;
}

export class Builders implements Builder, RenderableProvider<HintRenderable> {
  constructor(private builders: Iterable<Builder>) { }
  get() { return this }
  reset() { for (const b of this.builders) b.reset() }
  draw(gl: WebGLRenderingContext, state: State) { for (const b of this.builders) b.get().draw(gl, state) }
  accept(consumer: RenderableConsumer<HintRenderable>): void { for (const b of this.builders) b.accept(consumer) }
  needToRebuild() { for (const b of this.builders) b.needToRebuild() }
}