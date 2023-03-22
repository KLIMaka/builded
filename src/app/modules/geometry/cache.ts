import { forEach, getOrCreate } from 'utils/collections';
import { create, Dependency, getInstances, lifecycle, Module, plugin, provider } from '../../../utils/injector';
import { ART, ArtProvider, BOARD, BoardProvider, LIGHTMAPS, Lightmaps, SCHEDULER, Scheduler, SchedulerTask, STATE, State, TaskHandle } from '../../apis/app';
import { Builder } from '../../apis/builder';
import { BUS, busDisconnector, MessageHandler, MessageHandlerReflective } from '../../apis/handler';
import { BuildRenderableProvider, ClusterRenderable, Renderable, SectorRenderable, WallRenderable } from '../../apis/renderable';
import { BoardInvalidate } from '../../edit/messages';
import { SectorBuilder, updateSector } from './builders/sector';
import { updateCluster } from './builders/sectorcluster';
import { SectorHelperBuilder, updateSectorHelper } from './builders/sectorhelper';
import { SectorSelectedBuilder, updateSectorSelected, updateWallSelected, WallSelectedBuilder } from './builders/selected';
import { updateSprite } from './builders/sprite';
import { updateSprite2d } from './builders/sprite2d';
import { updateSpriteHelper } from './builders/spritehelper';
import { updateWall } from './builders/wall';
import { updateWall2d } from './builders/wall2d';
import { updateWallHelper, WallHelperBuilder } from './builders/wallhelper';
import { updateWallPoint } from './builders/wallpointhelper';
import { BuildersFactory, BUILDERS_FACTORY } from './common';

class Entry<T> {
  constructor(public value: T, public valid: boolean = false) { }
  update(value: T) { this.value = value; this.valid = true; }
}

type Updater<T> = (ctx: RenderablesCacheContext, id: number, value: T) => T;

class CacheMap<T extends Builder> {
  constructor(
    readonly update: Updater<T>
  ) { }

  private cache: Map<number, Entry<T>> = new Map();

  get(id: number, ctx: RenderablesCacheContext): T {
    const v = getOrCreate(this.cache, id, id => new Entry<T>(null));
    if (!v.valid) {
      v.update(this.update(ctx, id, v.value));
      v.value.needToRebuild();
    }
    return v.value;
  }

  invalidate(id: number) {
    const v = this.cache.get(id);
    if (!v) return;
    if (v.value) v.value.reset();
    v.valid = false;
  }

  invalidateAll() {
    forEach(this.cache.keys(), k => this.invalidate(k));
  }
}


export class CachedTopDownBuildRenderableProvider implements BuildRenderableProvider {
  private walls = new CacheMap(updateWall2d);
  private sprites = new CacheMap(updateSprite2d);

  constructor(
    private ctx: RenderablesCacheContext,
    private NULL_SECTOR_RENDERABLE = new SectorBuilder(ctx.factory)
  ) { }

  sector(id: number): SectorRenderable { return this.NULL_SECTOR_RENDERABLE }
  sectorCluster(id: number): ClusterRenderable { throw new Error('Cant render clusters') }
  wall(id: number): WallRenderable { return this.walls.get(id, this.ctx) }
  wallPoint(id: number): Renderable { throw new Error('Cant render points') }
  sprite(id: number): Renderable { return this.sprites.get(id, this.ctx) }
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
  private clusters = new CacheMap(updateCluster);

  constructor(
    private ctx: RenderablesCacheContext
  ) { }

  sector(id: number): SectorRenderable { return this.sectors.get(id, this.ctx) }
  sectorCluster(id: number): ClusterRenderable { return this.clusters.get(id, this.ctx) }
  wall(id: number): WallRenderable { return this.walls.get(id, this.ctx) }
  wallPoint(id: number): Renderable { throw new Error('Cant render points') }
  sprite(id: number): Renderable { return this.sprites.get(id, this.ctx) }
  invalidateSector(id: number) { this.sectors.invalidate(id) }
  invalidateWall(id: number) { this.walls.invalidate(id) }
  invalidateSprite(id: number) { this.sprites.invalidate(id) }

  invalidateAll() {
    this.sectors.invalidateAll();
    this.walls.invalidateAll();
    this.sprites.invalidateAll();
  }
}

export class CachedSelectedRenderableProvider implements BuildRenderableProvider {
  private sectors = new CacheMap((ctx, id, value: SectorSelectedBuilder) => updateSectorSelected(this.cache, ctx, id, value));
  private walls = new CacheMap((ctx, id, value: WallSelectedBuilder) => updateWallSelected(this.cache, ctx, id, value));

  constructor(
    private ctx: RenderablesCacheContext,
    readonly cache: CachedBuildRenderableProvider
  ) { }

  sector(id: number): SectorRenderable { return this.sectors.get(id, this.ctx) }
  sectorCluster(id: number): ClusterRenderable { throw new Error('Cant render clusters') }
  wall(id: number): WallRenderable { return this.walls.get(id, this.ctx) }
  wallPoint(id: number): Renderable { return null }
  sprite(id: number): Renderable { return null }
}

export class CachedHelperBuildRenderableProvider implements BuildRenderableProvider {
  private sectors = new CacheMap((ctx: RenderablesCacheContext, id: number, value: SectorHelperBuilder) => updateSectorHelper(this.cache, ctx, id, value));
  private walls = new CacheMap((ctx: RenderablesCacheContext, id: number, value: WallHelperBuilder) => updateWallHelper(this.cache, ctx, id, value));
  private sprites = new CacheMap(updateSpriteHelper);
  private wallPoints = new CacheMap(updateWallPoint);

  constructor(
    private ctx: RenderablesCacheContext,
    readonly cache: CachedBuildRenderableProvider
  ) { }

  sector(id: number): SectorRenderable { return this.sectors.get(id, this.ctx) }
  sectorCluster(id: number): ClusterRenderable { throw new Error('Cant render clusters') }
  wall(id: number): WallRenderable { return this.walls.get(id, this.ctx) }
  wallPoint(id: number): Renderable { return this.wallPoints.get(id, this.ctx) }
  sprite(id: number): Renderable { return this.sprites.get(id, this.ctx) }
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
  readonly selected: CachedSelectedRenderableProvider;
}
export const RENDRABLES_CACHE = new Dependency<RenderablesCache>('RenderablesCache');

export class RenderablesCacheContext {
  readonly board: BoardProvider;
  readonly art: ArtProvider;
  readonly factory: BuildersFactory;
  readonly state: State;
  readonly lightmaps: Lightmaps;
}
const RENDERABLES_CACHE_CONTEXT = new Dependency<RenderablesCacheContext>('RenderablesCacheContext');
const RenderablesCacheContextConstructor = provider(async injector => {
  const [board, art, factory, state, lightmaps] = await getInstances(injector, BOARD, ART, BUILDERS_FACTORY, STATE, LIGHTMAPS);
  return { board, art, factory, state, lightmaps }
});

const RenderablesCacheConstructor = lifecycle(async (injector, lifecycle) => {
  const cache = await create(injector, RenderablesCacheImpl, RENDERABLES_CACHE_CONTEXT, SCHEDULER);
  lifecycle(cache, async c => c.stop());
  return cache;
});

export const WALL_COLOR = 'wallColor';
export const MASKED_WALL_COLOR = 'maskedWallColor';
export const INTERSECTOR_WALL_COLOR = 'intersectorWallColor';
export const SPRITE_COLOR = 'spriteColor';

export async function RenderablesCacheModule(module: Module) {
  module.bind(RENDERABLES_CACHE_CONTEXT, RenderablesCacheContextConstructor);
  module.bind(RENDRABLES_CACHE, RenderablesCacheConstructor);
  module.bind(plugin('CacheBus'), lifecycle(async (injector, lifecycle) => {
    const [bus, state] = await getInstances(injector, BUS, STATE);
    const stateCleaner = async (s: string) => state.unregister(s);
    lifecycle(state.register(WALL_COLOR, [1, 1, 1, 1]), stateCleaner);
    lifecycle(state.register(INTERSECTOR_WALL_COLOR, [1, 0, 0, 1]), stateCleaner);
    lifecycle(state.register(MASKED_WALL_COLOR, [0, 0, 1, 1]), stateCleaner);
    lifecycle(state.register(SPRITE_COLOR, [0, 1, 1, 1]), stateCleaner);
    lifecycle(bus.connect(await injector.getInstance(RENDRABLES_CACHE)), busDisconnector(bus));
  }));
}

export class RenderablesCacheImpl extends MessageHandlerReflective implements RenderablesCache {
  readonly geometry: CachedBuildRenderableProvider;
  readonly helpers: CachedHelperBuildRenderableProvider;
  readonly topdown: CachedTopDownBuildRenderableProvider;
  readonly selected: CachedSelectedRenderableProvider;

  private preloadTask: TaskHandle;

  constructor(
    private ctx: RenderablesCacheContext,
    private scheduler: Scheduler
  ) {
    super();
    this.geometry = new CachedBuildRenderableProvider(ctx);
    this.helpers = new CachedHelperBuildRenderableProvider(ctx, this.geometry);
    this.topdown = new CachedTopDownBuildRenderableProvider(ctx);
    this.selected = new CachedSelectedRenderableProvider(ctx, this.geometry);
    // this.launchPrebuild();
  }

  public stop() {
    if (this.preloadTask != null) this.preloadTask.stop();
  }

  private launchPrebuild() {
    if (this.preloadTask != null) this.preloadTask.stop();
    this.preloadTask = this.scheduler.addTask(this.prebuild());
  }

  private * prebuild(): SchedulerTask {
    let handle = yield;
    handle.setDescription('Prebuild...');
    const board = this.ctx.board();
    for (let i = 0; i < board.sectors.length; i++) {
      this.geometry.sector(i);
      this.topdown.sector(i);
      handle.setDescription(`Prebuild. Sector ${i}`);
      handle = yield;
    }
    handle.setProgress(33);
    for (let i = 0; i < board.walls.length; i++) {
      this.geometry.wall(i);
      this.helpers.wall(i);
      handle.setDescription(`Prebuild. Wall ${i}`);
      handle = yield;
    }
    handle.setProgress(66);
    for (let i = 0; i < board.sprites.length; i++) {
      this.geometry.sprite(i);
      this.topdown.sprite(i);
      handle.setDescription(`Prebuild. Sprite ${i}`);
      handle = yield;
    }
  }

  BoardInvalidate(msg: BoardInvalidate) {
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

