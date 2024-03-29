import { mat2d, mat4 } from "gl-matrix";
import { EngineApi } from "../../build/board/mutations/api";
import { Board } from "../../build/board/structs";
import { ArtInfoProvider } from "../../build/formats/art";
import { EMPTY_TARGET, Ray, Target } from "../../build/hitscan";
import { MoveStruct } from "../../build/utils";
import { Texture } from "../../utils/gl/drawstruct";
import { Dependency } from "../../utils/injector";
import { MessageHandler } from "./handler";
import { ReferenceTracker } from "./referencetracker";
import { Renderable } from "./renderable";

export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'TRACE' | 'DEBUG';
export type Logger = (level: LogLevel, ...msg: any[]) => void;
export const LOGGER = new Dependency<Logger>('Logger');

export type Timer = () => number;
export const TIMER = new Dependency<Timer>('Timer');

export interface Storage {
  get<T>(key: string, def?: T): Promise<T>;
  set<T>(key: string, value: T): Promise<any>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}
export type Storages = (name: string) => Promise<Storage>;
export const STORAGES = new Dependency<Storages>('Storages');

export interface ArtProvider extends ArtInfoProvider {
  get(picnum: number): Texture;
  getParallaxTexture(picnum: number): Texture
}
export const ART = new Dependency<ArtProvider>('ArtProvider');


export enum SnapType {
  GRID, SPRITE, POINT_ON_WALL, WALL
}

export type SnapTarget = { target: Target, type: SnapType };
export const EMPTY_SNAP_TARGET: SnapTarget = { target: EMPTY_TARGET, type: SnapType.GRID };
export interface SnapTargets {
  get(): SnapTarget[];
  getByType(...types: SnapType[]): SnapTarget[];
  closest(): SnapTarget;
}

export const EMPLY_SNAP_TARGETS: SnapTargets = {
  get: () => [],
  getByType: (...types) => [],
  closest: () => EMPTY_SNAP_TARGET
};

export interface View extends MoveStruct, MessageHandler {
  drawTools(renderables: Iterable<Renderable>): void;
  targets(): Iterable<Target>;
  target(): Target;
  snapTargets(): SnapTargets;
  dir(): Ray;
}
export const VIEW = new Dependency<View>('View');

export const ENGINE_API = new Dependency<EngineApi>("Engine Api");
export type BoardProvider = () => Board;
export const BOARD = new Dependency<BoardProvider>('Borad');

export interface BoardUtils {
  spritesBySector(sectorId: number): number[];
}
export const BOARD_UTILS = new Dependency<BoardUtils>('BoardUtils');

export interface LightmapHandle {
  texture(): Texture;
}

export interface Lightmaps {
  ceiling(sectorId: number): mat2d;
  floor(sectorId: number): mat2d;
  lowerWall(wallId: number): mat4;
  upperWall(wallId: number): mat4;
  midWall(wallId: number): mat4;
}
export const LIGHTMAPS = new Dependency<Lightmaps>('Lightmaps');

export interface State {
  register<T>(name: string, defaultValue: T): string;
  unregister(name: string): void;
  set<T>(name: string, value: T): void;
  get<T>(name: string): T;
  has(name: string): boolean;
}
export const STATE = new Dependency<State>('State');


export interface Activity extends MessageHandler {
  name(): string;
  goFront(): Promise<void>;
  goBack(): Promise<void>;
}

export interface ActivityManager {
  register(activity: Activity): void;
}
export const ACTIVITY = new Dependency<ActivityManager>('ActivityManager');

export interface BuildReferenceTracker {
  readonly walls: ReferenceTracker<number, number>;
  readonly sectors: ReferenceTracker<number, number>;
  readonly sprites: ReferenceTracker<number, number>;
}
export const REFERENCE_TRACKER = new Dependency<BuildReferenceTracker>('BuildReferenceTracker');

export interface BuildResources {
  get(name: string): Promise<ArrayBuffer>;
  list(): Promise<string[]>;
}
export const RESOURCES = new Dependency<BuildResources>('Build Resources');


export interface GridController {
  setGridSize(size: number): void;
  getGridSize(): number;
  incGridSize(): void;
  decGridSize(): void;
  snap(x: number): number;
}
export const GRID = new Dependency<GridController>('GridController');


export type SchedulerTask = Generator<boolean, void, TaskHandle>;

export interface TaskHandle {
  stop(): void;
  getDescription(): string;
  getProgress(): number;
  setDescription(s: string): void;
  setProgress(p: number): void;
}

export interface ScheddulerHandler {
  onTaskAdd(task: TaskHandle): void;
  onTaskStop(task: TaskHandle): void;
  onTaskUpdate(task: TaskHandle): void;
}

export interface Scheduler {
  addTask(task: SchedulerTask): TaskHandle;
  addHandler(handler: ScheddulerHandler): ScheddulerHandler;
  removeHandler(handler: ScheddulerHandler): void;
  currentTasks(): Iterable<TaskHandle>;
}
export const SCHEDULER = new Dependency<Scheduler>('Scheduler'); 