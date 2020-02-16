import { Mat4Array, vec4 } from '../../../../../libs_js/glmatrix';
import { FastIterable, Deck } from '../../../../collections';
import { Texture } from '../../../../drawstruct';
import { State } from '../../../../stategl';
import { BuildContext } from '../../api';
import { BuildBuffer } from '../buffers';
import { BufferRenderable, GRID, GridSetup, PointSpriteSetup, POINT_SPRITE, SOLID, SolidSetup, WIREFRAME, WireframeSetup } from './setups';


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

const BASE = 0;
const SPRITE = 1;
const PARALLAX = 2;
const GRID1 = 3;
const SCREEN = 4;

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


export enum Type {
  SURFACE,
  FACE
}

let color = vec4.create();
export class SolidBuilder extends BufferRenderable<SolidSetup> {
  readonly buff = new BuildBuffer();
  public type: Type = Type.SURFACE;
  public tex: Texture;
  public shade: number;
  public trans: number = 1;
  public pal: number;
  public parallax: number = 0;

  constructor() { super(SOLID) }
  get layer() { return this.type == Type.SURFACE ? (this.parallax ? PARALLAX : BASE) : SPRITE }

  public setup(ctx: BuildContext, setup: SolidSetup) {
    setup.shader(this.type == Type.SURFACE ? (this.parallax ? 'parallax' : 'baseShader') : 'spriteShader')
      .base(this.tex)
      .color(vec4.set(color, 1, 1, 1, this.trans))
      .pal(this.pal)
      .shade(this.shade);
  }

  public reset() {
    this.buff.deallocate();
    this.type = Type.SURFACE;
    this.trans = 1;
    this.parallax = 0;
    this.tex = null;
    this.shade = 0;
    this.pal = 0;
  }
}

export class GridBuilder extends BufferRenderable<GridSetup> {
  readonly layer = GRID1;
  public solid: SolidBuilder;
  public gridTexMatProvider: (scale: number) => Mat4Array;

  constructor() { super(GRID) }

  public get buff() { return this.solid.buff }
  public reset() { }

  public setup(ctx: BuildContext, setup: GridSetup) {
    setup.shader('grid')
      .grid(this.gridTexMatProvider(ctx.gridScale));
  }
}

export class PointSpriteBuilder extends BufferRenderable<PointSpriteSetup> {
  readonly buff: BuildBuffer = new BuildBuffer();
  readonly layer = SCREEN;
  public tex: Texture;
  public color = vec4.fromValues(1, 1, 1, 1);

  constructor() { super(POINT_SPRITE) }

  public setup(ctx: BuildContext, setup: PointSpriteSetup) {
    setup.shader('spriteFaceShader')
      .base(this.tex)
      .color(this.color);
  }

  public reset() {
    this.buff.deallocate();
    this.tex = null;
    vec4.set(this.color, 1, 1, 1, 1);
  }
}

export class WireframeBuilder extends BufferRenderable<WireframeSetup> {
  readonly buff: BuildBuffer = new BuildBuffer();
  public type: Type = Type.SURFACE;
  public color = vec4.fromValues(1, 1, 1, 1);
  public mode = WebGLRenderingContext.LINES;

  constructor() { super(WIREFRAME) }
  get layer() { return this.type == Type.SURFACE ? BASE : SPRITE }

  public setup(ctx: BuildContext, setup: WireframeSetup) {
    setup.shader(this.type == Type.SURFACE ? 'baseFlatShader' : 'spriteFlatShader')
      .color(this.color);
  }

  public reset() {
    this.buff.deallocate();
    this.type = Type.SURFACE;
    this.mode = WebGLRenderingContext.LINES;
    vec4.set(this.color, 1, 1, 1, 1);
  }
}