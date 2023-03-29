import { Element } from "utils/ui/ui";
import { Dependency } from "../../utils/injector";

export interface Window {
  readonly contentElement: HTMLElement;
  readonly headerElement: HTMLElement;
  readonly winElement: HTMLElement;
  onclose: () => void;
  show(): void;
  hide(): void;
  destroy(): void;
}

export interface Ui {
  createWindow(id: string, defw: number, defh: number): Window;

  footer: Element;
}

export const UI = new Dependency<Ui>('UI');