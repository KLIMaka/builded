import { Texture } from "../../drawstruct";
import { ArtInfoProvider } from "./art";
import { Renderable } from "./gl/builders/renderable";
import { Context, Message, MessageHandler } from "./handlerapi";
import { Entity, Ray } from "./hitscan";
import { ReferenceTracker } from "./referencetracker";
import { Board } from "./structs";
import { MoveStruct } from "./utils";
import { Dependency } from "../../../libs/injector";
import { InputState } from "../../input";

export interface ArtProvider extends ArtInfoProvider {
  get(picnum: number): Texture;
  getParallaxTexture(picnum: number): Texture
}
export const ArtProvider_ = new Dependency<ArtProvider>('ArtProvider');

export interface Bindable {
  bind(ctx: BuildContext): void;
}

export interface Target {
  readonly coords: [number, number, number];
  readonly entity: Entity;
}

export interface View extends MoveStruct, Bindable, MessageHandler {
  draw(renderable: Renderable): void;
  target(): Target;
  snapTarget(): Target;
  dir(): Ray;
  isWireframe(): boolean;
}
export const View_ = new Dependency<View>('View');

export interface BoardManipulator {
  cloneBoard(board: Board): Board;
}
export const BoardManipulator_ = new Dependency<BoardManipulator>('BoardManipulator');
export const Board_ = new Dependency<Board>('Borad');

export interface State {
  register<T>(name: string, defaultValue: T): void;
  set<T>(name: string, value: T): void;
  get<T>(name: string): T;
}
export const State_ = new Dependency<State>('State');

export type ContextedValue<T> = (ctx: BuildContext) => T;
export const constCtxValue = <T>(value: T) => (ctx: BuildContext): T => value
export const stateCtxValue = <T>(name: string) => (ctx: BuildContext): T => ctx.state.get(name)

export interface BuildReferenceTracker {
  readonly walls: ReferenceTracker<number, number>;
  readonly sectors: ReferenceTracker<number, number>;
  readonly sprites: ReferenceTracker<number, number>;
}
export const BuildReferenceTracker_ = new Dependency<BuildReferenceTracker>('BuildReferenceTracker');

export interface BuildContext extends Context {
  readonly art: ArtProvider;
  readonly board: Board;
  readonly refs: BuildReferenceTracker;
  readonly state: State;
  readonly gridScale: number;
  readonly view: View;

  snap(x: number): number;
  commit(): void;
  message(msg: Message): void;
  addHandler(handler: MessageHandler): void;
  frame(input: InputState, dt: number): void;
}
export const BuildContext_ = new Dependency<BuildContext>('BuildContext');
