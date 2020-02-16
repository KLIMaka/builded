import { Bindable, BuildContext } from '../api';
import { BoardInvalidate } from '../edit/messages';
import { MessageHandlerReflective, MessageHandler } from '../handlerapi';
import { Builder } from './builders/api';
import { SectorBuilder, updateSector } from './builders/sector';
import { SectorHelperBuilder, updateSectorHelper } from './builders/sectorhelper';
import { updateSprite } from './builders/sprite';
import { updateSprite2d } from './builders/sprite2d';
import { updateSpriteHelper } from './builders/spritehelper';
import { updateWall } from './builders/wall';
import { updateWall2d } from './builders/wall2d';
import { updateWallHelper, WallHelperBuilder } from './builders/wallhelper';
import { updateWallPoint } from './builders/wallpointhelper';
import { BuildRenderableProvider, Renderable, SectorRenderable, WallRenderable, RenderableProvider, LayeredRenderable } from './builders/renderable';
import { Dependency } from '../../../../libs/injector';

class Entry<T> {
  constructor(public value: T, public valid: boolean = false) { }
  update(value: T) { this.value = value; this.valid = true; }
}

class CacheMap<T extends Builder> {
  constructor(
    readonly update: (ctx: BuildContext, id: number, value: T) => T
  ) { }

  private cache: { [index: number]: Entry<T> } = {};

  get(id: number, ctx: BuildContext): T {
    let v = this.ensureValue(id);
    if (!v.valid) v.update(this.update(ctx, id, v.value));
    return v.value;
  }

  private ensureValue(id: number) {
    let v = this.cache[id];
    if (v == undefined) {
      v = new Entry<T>(null);
      this.cache[id] = v;
    }
    return v;
  }

  invalidate(id: number) {
    let v = this.cache[id];
    if (v == undefined) return;
    v.value.reset();
    v.valid = false;
  }

  invalidateAll() {
    for (let id in this.cache) {
      this.invalidate(<any>id);
    }
  }
}

const NULL_SECTOR_RENDERABLE = new SectorBuilder();

export class CachedTopDownBuildRenderableProvider implements BuildRenderableProvider {
  private walls = new CacheMap(updateWall2d);
  private sprites = new CacheMap(updateSprite2d);
  private ctx: BuildContext;

  bind(ctx: BuildContext): void { this.ctx = ctx }
  sector(id: number): SectorRenderable { return NULL_SECTOR_RENDERABLE }
  wall(id: number): WallRenderable { return this.walls.get(id, this.ctx) }
  wallPoint(id: number): RenderableProvider<LayeredRenderable> { throw new Error('Cant render points') }
  sprite(id: number): RenderableProvider<LayeredRenderable> { return this.sprites.get(id, this.ctx) }
  invalidateSector(id: number) { }
  invalidateWall(id: number) { this.walls.invalidate(id) }
  invalidateSprite(id: number) { this.sprites.invalidate(id) }

  invalidateAll() {
    this.walls.invalidateAll();
    this.sprites.invalidateAll();
  }
}

export class CachedBuildRenderableProvider implements BuildRenderableProvider {
  private sectors = new CacheMap(updateSector);
  private walls = new CacheMap(updateWall);
  private sprites = new CacheMap(updateSprite);
  private ctx: BuildContext;

  bind(ctx: BuildContext): void { this.ctx = ctx }
  sector(id: number): SectorRenderable { return this.sectors.get(id, this.ctx) }
  wall(id: number): WallRenderable { return this.walls.get(id, this.ctx) }
  wallPoint(id: number): RenderableProvider<LayeredRenderable> { throw new Error('Cant render points') }
  sprite(id: number): RenderableProvider<LayeredRenderable> { return this.sprites.get(id, this.ctx) }
  invalidateSector(id: number) { this.sectors.invalidate(id) }
  invalidateWall(id: number) { this.walls.invalidate(id) }
  invalidateSprite(id: number) { this.sprites.invalidate(id) }

  invalidateAll() {
    this.sectors.invalidateAll();
    this.walls.invalidateAll();
    this.sprites.invalidateAll();
  }
}


export class CachedHelperBuildRenderableProvider implements BuildRenderableProvider {
  private sectors = new CacheMap((ctx: BuildContext, id: number, value: SectorHelperBuilder) => updateSectorHelper(this.cache, ctx, id, value));
  private walls = new CacheMap((ctx: BuildContext, id: number, value: WallHelperBuilder) => updateWallHelper(this.cache, ctx, id, value));
  private sprites = new CacheMap(updateSpriteHelper);
  private wallPoints = new CacheMap(updateWallPoint);
  private ctx: BuildContext;

  constructor(readonly cache: CachedBuildRenderableProvider) { }

  bind(ctx: BuildContext): void { this.ctx = ctx }
  sector(id: number): SectorRenderable { return this.sectors.get(id, this.ctx) }
  wall(id: number): WallRenderable { return this.walls.get(id, this.ctx) }
  wallPoint(id: number): RenderableProvider<LayeredRenderable> { return this.wallPoints.get(id, this.ctx) }
  sprite(id: number): RenderableProvider<LayeredRenderable> { return this.sprites.get(id, this.ctx) }
  invalidateSector(id: number) { this.sectors.invalidate(id) }
  invalidateSprite(id: number) { this.sprites.invalidate(id) }

  invalidateWall(id: number) {
    this.walls.invalidate(id);
    this.wallPoints.invalidate(id);
  }

  invalidateAll() {
    this.sectors.invalidateAll();
    this.walls.invalidateAll();
    this.sprites.invalidateAll();
    this.wallPoints.invalidateAll();
  }
}

export interface RenderablesCache extends MessageHandler {
  readonly geometry: CachedBuildRenderableProvider;
  readonly helpers: CachedHelperBuildRenderableProvider;
  readonly topdown: CachedTopDownBuildRenderableProvider;
}
export const RenderablesCache_ = new Dependency<RenderablesCache>('RenderablesCache');

export class RenderablesCacheImpl extends MessageHandlerReflective implements RenderablesCache {
  readonly geometry: CachedBuildRenderableProvider;
  readonly helpers: CachedHelperBuildRenderableProvider;
  readonly topdown: CachedTopDownBuildRenderableProvider;

  constructor() {
    super();
    this.geometry = new CachedBuildRenderableProvider();
    this.helpers = new CachedHelperBuildRenderableProvider(this.geometry);
    this.topdown = new CachedTopDownBuildRenderableProvider();
  }

  bind(ctx: BuildContext): void {
    this.geometry.bind(ctx);
    this.helpers.bind(ctx);
    this.topdown.bind(ctx);
  }

  BoardInvalidate(msg: BoardInvalidate, ctx: BuildContext) {
    if (msg.ent == null) this.invalidateAll();
    else if (msg.ent.isSector()) this.invalidateSector(msg.ent.id);
    else if (msg.ent.isSprite()) this.invalidateSprite(msg.ent.id);
    else if (msg.ent.isWall()) this.invalidateWall(msg.ent.id);
  }

  private invalidateAll(): void {
    this.geometry.invalidateAll();
    this.helpers.invalidateAll();
    this.topdown.invalidateAll();
  }

  private invalidateSector(id: number): void {
    this.geometry.invalidateSector(id);
    this.helpers.invalidateSector(id);
    this.topdown.invalidateSector(id);
  }

  private invalidateWall(id: number): void {
    this.geometry.invalidateWall(id);
    this.helpers.invalidateWall(id);
    this.topdown.invalidateWall(id);
  }

  private invalidateSprite(id: number): void {
    this.geometry.invalidateSprite(id);
    this.helpers.invalidateSprite(id);
    this.topdown.invalidateSprite(id);
  }
}

