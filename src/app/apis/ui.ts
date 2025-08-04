import { Dependency } from "ts-utils/injector";
import { BiFunction, Consumer, Supplier } from "ts-utils/types";
import Optional from "optional-js";
import { Action, ActionDescriptors, ActionHandler, ActionsProvider } from "./actions";
import { Disconnector } from "./app1";

export type ElemMod = Consumer<HTMLElement>;
export type Event = keyof HTMLElementEventMap;
export type EventType<K extends Event> = HTMLElementEventMap[K];

export const clazz = {
  add: (...c: string[]): ElemMod => e => e.classList.add(...c.filter(c => c)),
  remove: (...c: string[]): ElemMod => e => e.classList.remove(...c.filter(c => c)),
  toggle: (c: string): ElemMod => e => e.classList.toggle(c)
}

export const style = {
  width: (w: string): ElemMod => e => e.style.width = w,
  z: (z: number): ElemMod => e => e.style.zIndex = z.toString(),
  custom: (mod: Consumer<CSSStyleDeclaration>): ElemMod => e => mod(e.style),
  positionAbsolute: (): ElemMod => e => e.style.position = 'absolute',
}

export const blockActions = {
  click: (b: Block): Consumer<void> => () => b.mod(e => e.click()),
  focus: (b: Block): Consumer<void> => () => b.mod(e => e.focus()),
}

export interface Block {
  append(child: Block): this;
  replace(child?: Block): this;
  remove(child: Block): this;
  mod(mod: Consumer<HTMLElement>): this;
  text(text: string): this;
  event<K extends Event>(type: K, listener: Consumer<EventType<K>>): this;
  elem(): HTMLElement;
  cast<T extends HTMLElement>(): T;
}

export interface Layout extends Widget {
  insert(block: Block, size?: string): this;
  widget(widget: Widget, size?: string): this;
  clazz(clazz: string, size?: string): this;
  classes(classes: string[], size?: string): this;
  resizable(block: Block, size: number, min: number, max: number): this;
  clear(): void;
}

export interface BlockBuilder {
  block(...classes: string[]): Block;
  tag(tag: string, ...classes: string[]): Block;
  row(rootClass?: string[], elemClass?: string[], root?: Block): Layout;
  column(rootClass?: string[], elemClass?: string[], root?: Block): Layout;
}

export interface Widget {
  asWidget(): Block;
}

export interface ActionsWidget extends Widget, ActionsProvider {
  readonly defaultAction: Optional<ActionHandler>;
}

export class WindowBuilder {
  public width: number;
  public height: number;
  public minWidth: number;
  public minHeight: number;
  public titleElem: Block;
  public contentElem: Block;
  public footerElem: Block;
  public resizable = true;
  public draggable = true;
  public actionsList: ActionsProvider;
  public isAutoclose = false;

  title(elem: Block): this { this.titleElem = elem; return this }
  size(w: number, h: number): this { this.width = this.minWidth = w; this.height = this.minHeight = h; return this }
  minSize(w: number, h: number): this { this.minWidth = w; this.minHeight = h; return this }
  content(elem: Block): this { this.contentElem = elem; return this }
  footer(elem: Block): this { this.footerElem = elem; return this }
  contentWidget(elem: Widget): this { this.contentElem = elem.asWidget(); return this }
  actions(actions: Action[]) { this.actionsList = { actions: () => actions }; return this }
  actionsProvider(actions: Supplier<Iterable<Action>>) { this.actionsList = { actions }; return this }
  autoclose() { this.isAutoclose = true; return this }
}

export interface Window extends ActionsProvider {
  onclose: () => void;
  destroy(): void;
  hide: () => void;
}

export interface GroupsModel<T> extends Widget {
  select(item: T): void;
  selected(): T;
  addChangeHandler(handler: Consumer<T>): Disconnector;
  addItem(item: T): this;
  newBlock(): this;
  clear(): void;
}

export type Selector<R, T> = (record: R) => Promise<T>;
export type WidgetRenderer<T> = BiFunction<BlockBuilder, T, Block>;
export class TableColumn<R, T> {
  public size = 'auto';
  public renderer: WidgetRenderer<T>;
  public selector: Selector<R, T>;
  public title = '';
}

export interface Menu extends ActionsProvider {
  show(elem: Block): void;
}

export interface ActionsList extends Widget, ActionsProvider {
  addItem(item: ActionsWidget, selected?: boolean): void;
  clear(): void;
  clearSelection(): void;
  setHandler(handler: Consumer<ActionsWidget>): void;
}

export interface TableModel<R> extends ActionsProvider, Widget {
  setRowAction(action: Consumer<R>): void;
  addRow(row: R): number;
  selectRow(idx: number): void;
  getSelectedRowData(): R;
  clear(): void;
  addSelectionHandler(handler: Consumer<R>): Disconnector;
}

export interface Ui extends ActionsProvider, BlockBuilder {
  createWindow(builder: WindowBuilder): Window;
  showWindow(win: Window): void;
  hideWindow(win: Window): void;
  showPopup(elem: Block, content: Block, actions: ActionsProvider, closeCallback: Consumer<void>): Consumer<void>;
  setTopActionsProvider(provider: ActionsProvider): void;
  actionDescriptors(): ActionDescriptors;
}

export const UI = new Dependency<Ui>('UI');