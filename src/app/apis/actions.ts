import { Dependency } from "@utils/injector";
import { Consumer, Supplier } from "@utils/types";
import { Bind } from "app/input/keymap";
import Optional from "optional-js";

export interface ActionDescriptor {
  label(): Optional<string>;
  icon(): Optional<string>;
  descr(): Optional<string>;
  bind(): Optional<Bind>;
}

export interface ActionDescriptors {
  get(id: string): ActionDescriptor;
  sub(id: string): ActionDescriptors;
  bind(id: string, handler: ActionHandler): Action;
  bindSync(id: string, handler: Consumer<void>): Action;
}

export type ActionHandler = Supplier<Promise<void>>;
export type Action = { descriptor: ActionDescriptor, handler: ActionHandler }
export type ActionsProvider = { actions: Supplier<Iterable<Action>> }

export const ACTION_DESCRIPTORS = new Dependency<ActionDescriptors>('ActionDescriptors');