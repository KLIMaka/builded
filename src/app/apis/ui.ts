import { Element } from "utils/ui/ui";
import { Dependency } from "../../utils/injector";
import { MessageHandler } from "./handler";

export interface Window {
  readonly contentElement: HTMLElement;
  readonly headerElement: HTMLElement;
  readonly winElement: HTMLElement;
  onclose: () => void;
  show(): void;
  hide(): void;
  destroy(): void;
}

export interface Ui extends MessageHandler {
  createWindow(id: string, defw: number, defh: number): Window;
  getFooter(): Element;
}

export const UI = new Dependency<Ui>('UI');