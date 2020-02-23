import { ArtInfoProvider } from "../../build/art";
import { Ray, Target } from "../../build/hitscan";
import { Board } from "../../build/structs";
import { MoveStruct } from "../../build/utils";
import { Texture } from "../../utils/gl/drawstruct";
import { Dependency } from "../../utils/injector";
import { InputState } from "../../utils/input";
import { BuildersFactory } from "../modules/geometry/common";
import { Context, MessageHandler } from "./handler";
import { ReferenceTracker } from "./referencetracker";
import { Renderable, RenderableProvider, HintRenderable } from "./renderable";

export interface Storage {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<any>;
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

export interface View extends MoveStruct, MessageHandler {
  drawTools(provider: RenderableProvider<HintRenderable>): void;
  target(): Target;
  snapTarget(): Target;
  dir(): Ray;
}
export const VIEW = new Dependency<View>('View');

export interface BoardManipulator {
  cloneBoard(board: Board): Board;
}
export const BoardManipulator_ = new Dependency<BoardManipulator>('BoardManipulator');
export type BoardProvider = () => Board;
export const BOARD = new Dependency<BoardProvider>('Borad');
export const DEFAULT_BOARD = new Dependency<Board>('Default Board');

export interface State {
  register<T>(name: string, defaultValue: T): void;
  set<T>(name: string, value: T): void;
  get<T>(name: string): T;
}
export const STATE = new Dependency<State>('State');

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
