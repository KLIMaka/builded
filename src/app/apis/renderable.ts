import { Deck } from '../../utils/collections';
import { State, DrawCall } from '../../utils/gl/stategl';

export type DrawCallConsumer = (d: DrawCall) => void;
export interface Renderable {
  draw(consumer: DrawCallConsumer): void;
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

export const SPRITE_LABEL = 1 << 0;
export const HELPER_GRID = 1 << 1;

export interface HintRenderable extends Renderable {
  readonly hint: number;
  readonly kind: number;
}

const sorter = (l: HintRenderable, r: HintRenderable): number => l.hint - r.hint;
export class SortingRenderable implements Renderable {
  private drawList: HintRenderable[] = [];

  constructor(
    private provider: RenderableProvider<HintRenderable>,
    private filter: (r: HintRenderable) => boolean = () => true
  ) { }

  draw(consumer: DrawCallConsumer): void {
    this.drawList = [];
    this.provider.accept(r => this.consume(r));
    const sorted = this.drawList.sort(sorter);
    for (const r of sorted) r.draw(consumer);
  }

  protected consume(r: HintRenderable) {
    if (!this.filter(r)) return;
    this.drawList.push(r);
  }
}

export const NULL_RENDERABLE: Renderable = {
  draw: (consumer: DrawCallConsumer) => { },
}

export class Renderables implements Renderable {
  constructor(private renderables: Iterable<Renderable>) { }
  public draw(consumer: DrawCallConsumer): void { for (const r of this.renderables) r.draw(consumer) }
}

export class LayeredRenderables implements RenderableProvider<HintRenderable>, Renderable {
  private list = new Deck<Renderable>();

  constructor(private providers: Iterable<RenderableProvider<HintRenderable>>) { }
  accept(consumer: RenderableConsumer<HintRenderable>): void { for (const p of this.providers) p.accept(consumer) }

  draw(consumer: DrawCallConsumer): void {
    this.list.clear();
    for (const p of this.providers) p.accept((r) => this.list.push(r));
    for (const r of this.list) r.draw(consumer);
  }
}

export class WrapRenderable {
  constructor(
    private rend: Renderable,
    private pre: (gl: WebGLRenderingContext, state: State) => void,
    private post: (gl: WebGLRenderingContext, state: State) => void = () => { }
  ) { }

  draw(gl: WebGLRenderingContext, state: State): void {
    this.pre(gl, state);
    this.rend.draw(dc => state.run(gl, dc));
    state.flush(gl);
    this.post(gl, state);
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

export interface ClusterRenderable {
  readonly solids: RenderableProvider<HintRenderable>;
  readonly sprites: RenderableProvider<HintRenderable>;
  readonly transSolids: RenderableProvider<HintRenderable>;
  readonly transSprites: RenderableProvider<HintRenderable>;
}

export interface BuildRenderableProvider {
  sector(id: number): SectorRenderable;
  sectorCluster(id: number): ClusterRenderable;
  wall(id: number): WallRenderable;
  wallPoint(id: number): RenderableProvider<HintRenderable>;
  sprite(id: number): RenderableProvider<HintRenderable>;
}
