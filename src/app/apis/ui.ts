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

export interface WindowBuilder {
  title(title: string): WindowBuilder;
  draggable(draggable: boolean): WindowBuilder;
  centered(centered: boolean): WindowBuilder;
  closeable(closeable: boolean): WindowBuilder;
  size(width: number, height: number): WindowBuilder;
  onclose(h: () => void): WindowBuilder;
  toolbar(builder: ToolbarBuilder): WindowBuilder;
  content(content: HTMLElement): WindowBuilder;
  build(): Window;
}

export interface ToolbarBuilder {
  footer(): ToolbarBuilder,
  startGroup(): ToolbarBuilder;
  endGroup(): ToolbarBuilder;
  button(caption: string, click: () => void): ToolbarBuilder;
  iconButton(icon: string, click: () => void): ToolbarBuilder;
  widget(widget: HTMLElement): ToolbarBuilder;
}

export interface MenuBuilder {
  item(text: string, click: () => void): MenuBuilder
  build(elem: HTMLElement): void;
}

export interface UiBuilder {
  window(): WindowBuilder;
  toolbar(): ToolbarBuilder;
  menu(): MenuBuilder;
}


export interface Ui {
  readonly builder: UiBuilder;
}
export const UI = new Dependency<Ui>('UI');