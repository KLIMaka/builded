import { FastIterable } from "../../utils/collections";
import { State } from "../../utils/gl/stategl";
import { HintRenderable, Renderable, RenderableConsumer, RenderableProvider } from "./renderable";

export interface Builder extends RenderableProvider<HintRenderable> {
  reset(): void;
  get(): Renderable;
  needToRebuild(): void;
}

export class Builders implements Builder, RenderableProvider<HintRenderable> {
  constructor(private builders: FastIterable<Builder>) { }
  get() { return this }

  reset() {
    const size = this.builders.size;
    const array = this.builders.array;
    for (let i = 0; i < size; i++) array[i].reset()
  }

  draw(gl: WebGLRenderingContext, state: State) {
    const size = this.builders.size;
    const array = this.builders.array;
    for (let i = 0; i < size; i++) array[i].get().draw(gl, state)
  }

  accept(consumer: RenderableConsumer<HintRenderable>): void {
    const size = this.builders.size;
    const array = this.builders.array;
    for (let i = 0; i < size; i++) array[i].accept(consumer)
  }

  needToRebuild() {
    const size = this.builders.size;
    const array = this.builders.array;
    for (let i = 0; i < size; i++) array[i].needToRebuild();
  }
}