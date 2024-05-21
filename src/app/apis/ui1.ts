import { ActionsCollector } from "@ui/commons";
import { Dependency } from "@utils/injector";
import { Consumer } from "@utils/types";
import { ReactElement } from "react";
import { ActionsProvider } from "./actions";
import WinBox from "react-winbox";

export type Window = { winbox: WinBox };
export type WindowRenderer = (onClose: Consumer<void>, windowConsumer: Consumer<Window>) => ReactElement;
export interface Ui extends ActionsProvider {
  showWindow(renderer: WindowRenderer): Promise<Window>;
  globalActions(): ActionsCollector;
}

export const UI = new Dependency<Ui>('UI');