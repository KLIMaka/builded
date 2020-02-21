import { Deck, FastIterable } from '../../utils/collections';
import { State } from '../../utils/gl/stategl';
import { BuildContext } from './app';
import { SortedHeap } from '../../utils/list';


export interface Renderable {
  draw(ctx: BuildContext, gl: WebGLRenderingContext, state: State): void;
}

export type RenderableConsumer<T extends Renderable> = (r: T) => void;

export interface RenderableProvider<T extends Renderable> {
  accept(consumer: RenderableConsumer<T>): void;
}

export class RenderablesProvider<T extends Renderable> implements RenderableProvider<T> {
  constructor(private renderables: Iterable<T>) { }
  accept(consumer: RenderableConsumer<T>) { for (const p of this.renderables) consumer(p) }
}

export function consumerProvider<T extends Renderable>() {
  const list = new Deck<T>();
  const provider = new RenderablesProvider<T>(list);
  return {
    consumer: (r: T) => list.push(r),
    provider: provider,
    clear: () => list.clear()
  }
}

export const BASE = 0;
export const SPRITE = 1;
export const PARALLAX = 2;
export const GRID1 = 3;
export const SCREEN = 4;

export interface HintRenderable extends Renderable {
  readonly hint: number;
}

export class SortingRenderable implements Renderable {
  private drawList: [Renderable, number][] = [];

  constructor(private provider: RenderableProvider<HintRenderable>) { }

  draw(ctx: BuildContext, gl: WebGLRenderingContext, state: State): void {
    this.drawList = [];
    this.provider.accept((r) => this.consume(r));
    const sorted = this.drawList.sort((l, r) => l[1] - r[1]);
    for (const r of sorted) r[0].draw(ctx, gl, state);
  }

  private consume(r: HintRenderable) {
    this.drawList.push([r, r.hint]);
  }
}

export const NULL_RENDERABLE: Renderable = {
  draw: (ctx: BuildContext, gl: WebGLRenderingContext, state: State) => { },
}

export class Renderables implements Renderable {
  constructor(private renderables: FastIterable<Renderable>) { }
  public draw(ctx: BuildContext, gl: WebGLRenderingContext, state: State): void {
    const size = this.renderables.size;
    const array = this.renderables.array;
    for (let i = 0; i < size; i++) array[i].draw(ctx, gl, state)
  }
}

export class LayeredRenderables implements RenderableProvider<HintRenderable> {
  private list = new Deck<Renderable>();

  constructor(private providers: FastIterable<RenderableProvider<HintRenderable>>) { }
  accept(consumer: RenderableConsumer<HintRenderable>): void {
    const size = this.providers.size;
    const array = this.providers.array;
    for (let i = 0; i < size; i++) array[i].accept(consumer);
  }

  draw(ctx: BuildContext, gl: WebGLRenderingContext, state: State): void {
    this.list.clear();
    const size = this.providers.size;
    const array = this.providers.array;
    for (let i = 0; i < size; i++) array[i].accept((r) => this.list.push(r));
    for (const r of this.list) r.draw(ctx, gl, state);
  }
}

export class WrapRenderable implements Renderable {
  constructor(
    private rend: Renderable,
    private pre: (ctx: BuildContext, gl: WebGLRenderingContext, state: State) => void,
    private post: (ctx: BuildContext, gl: WebGLRenderingContext, state: State) => void = () => { }
  ) { }

  draw(ctx: BuildContext, gl: WebGLRenderingContext, state: State): void {
    this.pre(ctx, gl, state);
    this.rend.draw(ctx, gl, state);
    state.flush(gl);
    this.post(ctx, gl, state);
  }
}

export interface SectorRenderable extends RenderableProvider<HintRenderable>, Renderable {
  readonly ceiling: RenderableProvider<HintRenderable> & Renderable;
  readonly floor: RenderableProvider<HintRenderable> & Renderable;
}

export interface WallRenderable extends RenderableProvider<HintRenderable>, Renderable {
  readonly top: RenderableProvider<HintRenderable> & Renderable;
  readonly mid: RenderableProvider<HintRenderable> & Renderable;
  readonly bot: RenderableProvider<HintRenderable> & Renderable;
}

export interface BuildRenderableProvider {
  sector(id: number): SectorRenderable;
  wall(id: number): WallRenderable;
  wallPoint(id: number): RenderableProvider<HintRenderable>;
  sprite(id: number): RenderableProvider<HintRenderable>;
}
