import { ActionsCollector } from "@ui/commons";
import { Dependency } from "ts-utils/injector";
import { Consumer } from "ts-utils/types";
import { ReactElement } from "react";
import { ActionsProvider } from "./actions";
import { Disconnector } from "./app";

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