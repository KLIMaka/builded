import { Dependency } from "../../utils/injector";

export interface Window {
  readonly contentElement: HTMLElement;
  readonly winElement: HTMLElement;
  onclose: () => void;
  show(): void;
  hide(): void;
  setPosition(x: number | string, y: string | number): void;
  destroy(): void;
}

export interface Ui {
  createWindow(id: string): Window;
}

export const UI = new Dependency<Ui>('UI');