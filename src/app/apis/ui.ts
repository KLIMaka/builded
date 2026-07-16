import { ActionsCollector } from "@ui/commons";
import Optional from "optional-js";
import { ReactElement } from "react";
import { Dependency } from "ts-utils/injector";
import { Task } from "ts-utils/scheduler";
import { Consumer, Result } from "ts-utils/types";
import { ActionDescriptors, ActionsProvider } from "./actions";
import { App, Disconnector } from "./app";
import { Values } from "./values";
import { WindowBuilder } from "app/modules/ui/windows-common";
import { ValuesContainer } from "ts-utils/callbacks";

export type Window = {
  content: ReactElement,
  show(): Promise<void>,
  close(force?: boolean): Promise<void>,
  onClose(handle: Consumer<boolean>): Disconnector;
  focus(): Promise<void>;
  onFocus(handle: Consumer<void>): Disconnector;
  isModal(): boolean;
}

export interface Ui extends ActionsProvider {
  addWindow(window: Window): void;
  removeWindow(window: Window): void;
  globalActions(): ActionsCollector;
}

export const UI = new Dependency<Ui>('UI');

export type UiUtils = {
  readonly actionDescriptors: ActionDescriptors,
  readonly ui: Ui,
  readonly app: App,
  readonly values: Values,

  addWindow(title: string, task: Task<Window>): Promise<void>;
  waitFor<T>(title: string, task: Task<T>): Promise<Result<T>>;
  info(title: string, text: string, icon?: string): Promise<Optional<void>>;
  confirm(title: string, text: string): Promise<Optional<boolean>>;
  windowBuilder(id: string, values: ValuesContainer): WindowBuilder,
}

export const UI_UTILS = new Dependency<UiUtils>("UiUtils");