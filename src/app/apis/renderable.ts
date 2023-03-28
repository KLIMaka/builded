import { DrawCall } from 'utils/gl/stategl';

export type DrawCallConsumer = (d: DrawCall) => void;
export interface Renderable {
  drawCall(consumer: DrawCallConsumer): void;
}

export const NULL_RENDERABLE: Renderable = { drawCall: (consumer: DrawCallConsumer) => { } }

export const SPRITE_LABEL = 1 << 0;
export const HELPER_GRID = 1 << 1;

const SORTER = (l: DrawCall, r: DrawCall): number => l.hint - r.hint;
export class SortingRenderable implements Renderable {
  private drawList: DrawCall[] = [];

  constructor(
    private renderables: Iterable<Renderable>,
    private filter: (kind: number) => boolean = () => true
  ) { }

  drawCall(consumer: DrawCallConsumer): void {
    this.drawList = [];
    for (const r of this.renderables) r.drawCall(dc => {
      if (this.filter(dc.kind)) this.drawList.push(dc);
    });
    const sorted = this.drawList.sort(SORTER);
    for (const dc of sorted) consumer(dc);
  }
}

export class Renderables implements Renderable {
  constructor(private renderables: Iterable<Renderable>) { }
  public drawCall(consumer: DrawCallConsumer): void { for (const r of this.renderables) r.drawCall(consumer) }
}

export interface SectorRenderable extends Renderable {
  readonly ceiling: Renderable;
  readonly floor: Renderable;
}

export interface WallRenderable extends Renderable {
  readonly top: Renderable;
  readonly mid: Renderable;
  readonly bot: Renderable;
}

export interface ClusterRenderable {
  readonly solids: Renderable;
  readonly sprites: Renderable;
  readonly transSolids: Renderable;
  readonly transSprites: Renderable;
}

export interface BuildRenderableProvider {
  sector(id: number): SectorRenderable;
  sectorCluster(id: number): ClusterRenderable;
  wall(id: number): WallRenderable;
  wallPoint(id: number): Renderable;
  sprite(id: number): Renderable;
}
