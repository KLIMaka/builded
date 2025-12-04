import { Source } from "ts-utils/callbacks";
import { Dependency } from "ts-utils/injector";
import { Consumer, Supplier } from "ts-utils/types";
import { Bind } from "app/input/keymap";
import Optional from "optional-js";

export interface ActionDescriptor {
  readonly id: string;

  label(): Optional<string>;
  icon(): Optional<string>;
  descr(): Optional<string>;
  bind(): Optional<Bind>;
}

export interface ActionDescriptors {
  get(id: string): ActionDescriptor;
  sub(id: string): ActionDescriptors;
  bind(id: string, handler: ActionHandler, enabled?: Source<boolean>): Action;
  bindSync(id: string, handler: Consumer<void>, enabled?: Source<boolean>): Action;
}

export type ActionHandler = Supplier<Promise<void>>;
export type Action = { descriptor: ActionDescriptor, handler: ActionHandler, enabled: Source<boolean> }
export type StateChecker = { bind: Bind, action: Consumer<boolean> }
export type ActionsProvider = { actions: Supplier<Iterable<Action>>, states: Supplier<Iterable<StateChecker>> }

export const ACTION_DESCRIPTORS = new Dependency<ActionDescriptors>('ActionDescriptors');