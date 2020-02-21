import { Renderable, RenderableProvider, RenderableConsumer, HintRenderable } from "./renderable";
import { BuildContext } from "./app";
import { State } from "../../utils/gl/stategl";
import { FastIterable } from "../../utils/collections";

export interface Builder extends RenderableProvider<HintRenderable> {
  reset(): void;
  get(): Renderable;
}

export class Builders implements Builder, RenderableProvider<HintRenderable> {
  constructor(private builders: FastIterable<Builder>) { }
  get() { return this }

  reset() {
    const size = this.builders.size;
    const array = this.builders.array;
    for (let i = 0; i < size; i++) array[i].reset()
  }

  draw(ctx: BuildContext, gl: WebGLRenderingContext, state: State) {
    const size = this.builders.size;
    const array = this.builders.array;
    for (let i = 0; i < size; i++) array[i].get().draw(ctx, gl, state)
  }

  accept(consumer: RenderableConsumer<HintRenderable>): void {
    const size = this.builders.size;
    const array = this.builders.array;
    for (let i = 0; i < size; i++) array[i].accept(consumer)
  }
}