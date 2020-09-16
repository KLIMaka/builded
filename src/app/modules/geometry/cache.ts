import { create, Dependency, Injector } from '../../../utils/injector';
import { ART, ArtProvider, BOARD, BoardProvider, STATE, State, SCHEDULER, Scheduler, TaskHandle, SchedulerTask } from '../../apis/app';
import { Builder } from '../../apis/builder';
import { BUS, MessageHandler, MessageHandlerReflective } from '../../apis/handler';
import { BuildRenderableProvider, ClusterRenderable, SectorRenderable, WallRenderable, Renderable } from '../../apis/renderable';
import { BoardInvalidate, NamedMessage, LoadBoard } from '../../edit/messages';
import { SectorBuilder, updateSector } from './builders/sector';
import { updateCluster } from './builders/sectorcluster';
import { SectorHelperBuilder, updateSectorHelper } from './builders/sectorhelper';
import { updateSprite } from './builders/sprite';
import { updateSprite2d } from './builders/sprite2d';
import { updateSpriteHelper } from './builders/spritehelper';
import { updateWall } from './builders/wall';
import { updateWall2d } from './builders/wall2d';
import { updateWallHelper, WallHelperBuilder } from './builders/wallhelper';
import { updateWallPoint } from './builders/wallpointhelper';
import { BuildersFactory, BUILDERS_FACTORY, FlatBuilder, SolidBuilder } from './common';
import { updateSectorSelected, SectorSelectedBuilder, updateWallSelected, WallSelectedBuilder } from './builders/selected';

class Entry<T> {
  constructor(public value: T, public valid: boolean = false) { }
  update(value: T) { this.value = value; this.valid = true; }
}

class CacheMap<T extends Builder> {
  constructor(
    readonly update: (ctx: RenderablesCacheContext, id: number, value: T) => T
  ) { }

  private cache: { [index: number]: Entry<T> } = {};

  get(id: number, ctx: RenderablesCacheContext): T {
    let v = this.ensureValue(id);
    if (!v.valid) {
      v.update(this.update(ctx, id, v.value));
      v.value.needToRebuild();
    }
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
}
const RENDERABLES_CACHE_CONTEXT = new Dependency<RenderablesCacheContext>('RenderablesCacheContext');
async function RenderablesCacheContextConstructor(injector: Injector): Promise<RenderablesCacheContext> {
  const [board, art, factory, state] = await Promise.all([
    injector.getInstance(BOARD),
    injector.getInstance(ART),
    injector.getInstance(BUILDERS_FACTORY),
    injector.getInstance(STATE),
  ]);
  return { board, art, factory, state }
}

async function RenderablesCacheConstructor(injector: Injector) {
  return create(injector, RenderablesCacheImpl, RENDERABLES_CACHE_CONTEXT, SCHEDULER);
}

export const WALL_COLOR = 'wallColor';
export const MASKED_WALL_COLOR = 'maskedWallColor';
export const INTERSECTOR_WALL_COLOR = 'intersectorWallColor';
export const SPRITE_COLOR = 'spriteColor';

export async function RenderablesCacheModule(injector: Injector) {
  injector.bind(RENDERABLES_CACHE_CONTEXT, RenderablesCacheContextConstructor);
  injector.bind(RENDRABLES_CACHE, RenderablesCacheConstructor);
  const state = await injector.getInstance(STATE);
  state.register(WALL_COLOR, [1, 1, 1, 1]);
  state.register(INTERSECTOR_WALL_COLOR, [1, 0, 0, 1]);
  state.register(MASKED_WALL_COLOR, [0, 0, 1, 1]);
  state.register(SPRITE_COLOR, [0, 1, 1, 1]);

  const bus = await injector.getInstance(BUS);
  const cache = await injector.getInstance(RENDRABLES_CACHE);
  bus.connect(cache);
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
    this.launchPrebuild();
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

  LoadBoard(msg: LoadBoard) {
    this.invalidateAll();
    this.launchPrebuild();
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

