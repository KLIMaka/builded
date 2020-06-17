import { Dependency } from "../../utils/injector";


export interface Window {
  readonly contentElement: HTMLElement;
  readonly winElement: HTMLElement;
  onclose: () => void;
  show(): void;
  hide(): void;
  setPosition(x: number | string, y: string | number): void;
}

export interface WindowBuilder {
  id(id: string): WindowBuilder;
  title(title: string): WindowBuilder;
  draggable(draggable: boolean): WindowBuilder;
  centered(centered: boolean): WindowBuilder;
  closeable(closeable: boolean): WindowBuilder;
  size(width: number, height: number): WindowBuilder;
  onclose(h: () => void): WindowBuilder;
  toolbar(builder: ToolbarBuilder): WindowBuilder;
  build(): Window;
}

export interface ToolbarBuilder {
  startGroup(): ToolbarBuilder;
  endGroup(): ToolbarBuilder;
  button(icon: string, click: () => void): ToolbarBuilder;
  search(hint: string, change: (s: string) => void): ToolbarBuilder;
  menuButton(icon: string, menu: MenuBuilder): ToolbarBuilder;
}

export interface MenuBuilder {
  item(text: string, click: () => void): MenuBuilder
  build(elem: HTMLElement): void;
}

export interface UiBuilder {
  windowBuilder(): WindowBuilder;
  toolbarBuilder(): ToolbarBuilder;
  menuBuilder(): MenuBuilder;
}

export interface Ui {
  readonly builder: UiBuilder;
}
export const UI = new Dependency<Ui>('UI');