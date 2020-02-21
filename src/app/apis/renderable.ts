import { Mat4Array, vec4 } from '../../libs_js/glmatrix';
import { FastIterable, Deck } from '../../utils/collections';
import { State } from '../../utils/gl/stategl';
import { BuildContext } from './app';
import { BuildBuffer, BUFFER_FACTORY } from '../modules/gl/buffers';
import { BufferRenderable, GRID, GridSetup, PointSpriteSetup, POINT_SPRITE, SOLID, SolidSetup, WIREFRAME, WireframeSetup } from '../modules/geometry/builders/setups';
import { Texture } from '../../utils/gl/drawstruct';
import { Dependency, Injector } from '../../utils/injector';


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

export interface LayeredRenderable extends Renderable {
  readonly layer: number;
}

export class SortingRenderable implements Renderable {
  private drawLists = [
    new Deck<Renderable>(),
    new Deck<Renderable>(),
    new Deck<Renderable>(),
    new Deck<Renderable>(),
    new Deck<Renderable>()
  ];

  constructor(private provider: RenderableProvider<LayeredRenderable>) { }

  draw(ctx: BuildContext, gl: WebGLRenderingContext, state: State): void {
    for (const list of this.drawLists) list.clear();
    this.provider.accept((r) => this.consume(r));
    for (const list of this.drawLists) for (const r of list) r.draw(ctx, gl, state);
  }

  private consume(r: LayeredRenderable) {
    this.drawLists[r.layer].push(r);
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

export class LayeredRenderables implements RenderableProvider<LayeredRenderable> {
  private list = new Deck<Renderable>();

  constructor(private providers: FastIterable<RenderableProvider<LayeredRenderable>>) { }
  accept(consumer: RenderableConsumer<LayeredRenderable>): void {
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

export interface SectorRenderable extends RenderableProvider<LayeredRenderable>, Renderable {
  readonly ceiling: RenderableProvider<LayeredRenderable> & Renderable;
  readonly floor: RenderableProvider<LayeredRenderable> & Renderable;
}

export interface WallRenderable extends RenderableProvider<LayeredRenderable>, Renderable {
  readonly top: RenderableProvider<LayeredRenderable> & Renderable;
  readonly mid: RenderableProvider<LayeredRenderable> & Renderable;
  readonly bot: RenderableProvider<LayeredRenderable> & Renderable;
}

export interface BuildRenderableProvider {
  sector(id: number): SectorRenderable;
  wall(id: number): WallRenderable;
  wallPoint(id: number): RenderableProvider<LayeredRenderable>;
  sprite(id: number): RenderableProvider<LayeredRenderable>;
}
