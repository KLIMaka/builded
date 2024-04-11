import { ChangeCallback } from "@utils/callbacks";
import { chain } from "@utils/collections";
import { Module, Plugin, lifecycle } from "@utils/injector";
import { iter } from "@utils/iter";
import { List, Node } from "@utils/list";
import { Consumer, Supplier, Transform, nil } from "@utils/types";
import { DragConsumer, Element, addDragController, center, div, dragElement } from "@utils/ui/ui";
import { ACTION_DESCRIPTORS, Action, ActionDescriptors, ActionsProvider } from "app/apis/actions";
import $ from "jquery";
import "jqueryui";
import tippy, { Instance, Props } from "tippy.js";
import { Block, ElemMod, Event, EventType, Layout, Menu, UI, Ui, Widget, Window, WindowBuilder, clazz, style } from "../../apis/ui";
import Optional from "optional-js";
import { clamp } from "@utils/mathutils";

class WindowImpl implements Window, ActionsProvider {
  public onclose: () => void;
  protected win: Block;
  private content: Block;
  private header: Block;
  private footer: Block;
  private jqw: JQuery<HTMLElement>;
  private subActions: ActionsProvider;
  private autoclose: boolean;
  private winActions: Action[];

  constructor(private ui: BuildedUi, builder: WindowBuilder) {
    this.winActions = this.registerActions(ui.actionDescriptors().sub('win'));
    this.win = ui.block('window').mod(style.positionAbsolute());

    this.header = ui.block('window-head');
    this.win.append(this.header);
    if (builder.titleElem != null) {
      this.header.append(builder.titleElem);
    }

    this.content = ui.block('window-content');
    this.content.append(builder.contentElem);
    this.win.append(this.content);


    this.footer = ui.block('window-footer');
    this.win.append(this.footer);
    if (builder.footerElem != null) {
      this.footer.append(builder.footerElem);
    }

    this.subActions = builder.actionsList;
    this.autoclose = builder.isAutoclose;
    this.ui.getContent().appendHtml(this.win.elem());

    this.jqw = $(this.win.elem());
    if (builder.resizable) this.jqw.resizable();
    if (builder.draggable) this.jqw.draggable({ handle: (this.header ?? this.win).elem() });
    this.win.mod(style.custom(s => {
      s.width = `${builder.width}px`;
      s.height = `${builder.height}px`;
      s.minWidth = `${builder.minWidth}px`;
      s.minHeight = `${builder.minHeight}px`;
    }));
    center(ui.getContent().elem(), this.win.elem(), builder.width, builder.height);
    this.win.event('mousedown', e => this.ui.showWindow(this));
  }

  private registerActions(ctx: ActionDescriptors) {
    return [ctx.bind('close', async () => this.ui.hideWindow(this))];
  }

  actions(): Iterable<Action> {
    return this.subActions == null
      ? this.winActions
      : chain(this.subActions.actions(), this.winActions);
  }

  hide() { this.jqw.hide() }
  show() { this.jqw.show() }
  setZ(z: number) { this.win.mod(style.z(z)) }
  destroy() { this.ui.getDesktop().elem().removeChild(this.win.elem()) }
  loseFocus() { if (this.autoclose) this.ui.hideWindow(this) }
}

class BlockImpl implements Block {
  private static cast(block: Block): BlockImpl { return <BlockImpl>block }

  constructor(private html: HTMLElement) { }

  append(child: Block): this {
    this.html.append(BlockImpl.cast(child).html);
    return this;
  }

  replace(child?: Block): this {
    if (child) this.html.replaceChildren(BlockImpl.cast(child).html);
    else this.html.replaceChildren();
    return this;
  }

  remove(child: Block): this {
    this.html.removeChild(BlockImpl.cast(child).html)
    return this;
  }

  text(text: string): this {
    if (text == '') this.html.innerHTML = '&nbsp';
    else this.html.innerText = text;
    return this;
  }

  event<K extends Event>(type: K, listener: Consumer<EventType<K>>): this {
    this.html.addEventListener(type, ev => listener(ev));
    return this;
  }

  elem(): HTMLElement {
    return this.html;
  }

  cast<T extends HTMLElement>(): T {
    return <T>this.html;
  }

  mod(mod: Consumer<HTMLElement>): this {
    mod(this.html);
    return this;
  }
}

class LayoutImpl implements Layout {
  private last: Block;
  private nextConsumer: Optional<Consumer<Block>> = Optional.empty();

  constructor(
    private block: Supplier<Block>,
    private rootTransform: Transform<Block>,
    private partTransform: Transform<Block>,
    private row: boolean,
    private root: Block = block(),
  ) {
    this.root = this.rootTransform(root);
  }

  asWidget(): Block {
    return this.root;
  }

  insert(block: Block, size?: string): this {
    return this.builder(() => block, size);
  }

  widget(widget: Widget, size?: string): this {
    return this.builder(() => widget.asWidget(), size);
  }

  resizable(block: Block, size: number, min: number, max: number): this {
    const separator = this.block().mod(clazz.add(this.row ? 'row-separator' : 'col-separator'));
    let next: Block = null;
    let nsize = size;
    this.nextConsumer = Optional.of(b => next = b);
    const drag: DragConsumer = (dx, dy) => {
      nsize = clamp(size + (this.row ? dx : dy), min, max);
      next.mod(e => e.style.flexBasis = `${nsize}px`);
    }
    const end = () => size = nsize;
    dragElement(separator.cast(), this.row ? 'row-resize' : 'col-resize', drag, nil(), end, nil());
    this.builder(() => separator, '5px', true);
    return this.builder(() => block, `${size}px`);
  }

  clazz(c: string, size?: string): this {
    return this.builder(() => this.block().mod(clazz.add(c)), size);
  }

  classes(classes: string[], size?: string): this {
    return this.builder(() => this.block().mod(clazz.add(...classes)), size);
  }

  separator(): this {
    const musemove = (e: MouseEvent) => {
      const dx = e.clientX - startX;
      const elem = next.cast();
      elem.style.flexBasis = `${startSize - dx}px`;
    }
    const mouseup = (e: MouseEvent) => {
      document.body.removeEventListener('mouseup', mouseup);
      document.body.removeEventListener('mousemove', musemove);
      document.body.style.cursor = 'default';
    }
    const last = this.last;
    let next: Block = null;
    this.nextConsumer = Optional.of(b => next = b);
    const separator = this.block().mod(clazz.add('separator'));
    let startX = 0;
    let startSize = 0;
    const drag: DragConsumer = (dx, dy) => {

    }
    const dragStart = () => {
      const px = next.cast().style.flexBasis;
      // startSize = 
    }
    // dragElement(separator.cast(), 'col-resize', drag)
    return this.builder(() => separator, '5px', true);
  }

  clear(): void {
    this.root.replace();
  }

  private builder(builder: Supplier<Block>, size = 'auto', skipNext = false): this {
    this.last = this.partTransform(builder().mod(this.getStyles(size)));
    if (!skipNext) {
      this.nextConsumer.ifPresent(c => c(this.last));
      this.nextConsumer = Optional.empty();
    }
    this.root.append(this.last);
    return this;
  }

  private getStyles(size: string): ElemMod {
    if (size == 'auto' || size.endsWith('px')) return e => e.style.flex = `0 0 ${size}`;
    return e => e.style.flex = size;
  }
}


class BuildedUi implements Ui, ActionsProvider {
  private head: Element;
  private content: Element;
  private footer: Element;
  private desktop: Element;
  private windows = new List<WindowImpl>();
  private windowNodes = new Map<WindowImpl, Node<WindowImpl>>();
  private hiddenWindows = new Set<WindowImpl>();
  private uiActions: Action[] = [];
  private topActionsProvider: ActionsProvider;
  private popupInstance: Instance<Props>;
  private popupCloseCallback: ChangeCallback<void>;

  constructor(public _actions: ActionDescriptors) {
    this.uiActions = this.registerDefaultActions(_actions.sub('ui'));
    this.createDesktop();
  }

  private createDesktop() {
    this.head = div('desktop-header');
    this.content = div('desktop-content');
    this.footer = div('desktop-footer');
    this.desktop = div('desktop')
      .append(this.head)
      .append(this.content)
      .append(this.footer);
    document.body.appendChild(this.desktop.elem());
  }

  actions(): Iterable<Action> {
    if (this.topActionsProvider != null) return this.topActionsProvider.actions();
    return this.windows.isEmpty()
      ? this.uiActions
      : chain(this.windows.last().obj.actions(), this.uiActions);
  }

  private registerDefaultActions(ctx: ActionDescriptors) {
    return [
      ctx.bind('winswitch', async () => this.switchWin())
    ];
  }

  setTopActionsProvider(provider: ActionsProvider): void {
    this.topActionsProvider = provider;
  }

  showMenu(elem: Block, menu: Menu): void {
    menu.show(elem);
  }

  showPopup(elem: Block, content: Block, actions: ActionsProvider, closeCallback: Consumer<void>): Consumer<void> {
    this.popupInstance = tippy(elem.cast(), {
      content: content.cast(),
      allowHTML: true,
      placement: 'bottom-start',
      interactive: true,
      arrow: false,
      offset: [0, 0],
      trigger: "manual",
      appendTo: document.body,
      animation: false,
      onHide: () => { this.onHidePopup(); },
      onHidden: () => { this.popupInstance.destroy() }
    });
    this.popupCloseCallback = closeCallback;
    this.popupInstance.show();
    this.setTopActionsProvider(actions);
    return () => this.popupInstance.hide();
  }

  private onHidePopup() {
    this.setTopActionsProvider(null);
    this.popupCloseCallback?.();
    this.popupCloseCallback = null;
  }

  createWindow(builder: WindowBuilder): Window {
    const window = new WindowImpl(this, builder);
    this.showWindow(window);
    return window;
  }

  hideWindow(win: WindowImpl) {
    const winNode = this.windowNodes.get(win);
    if (winNode == null) return;
    this.windows.remove(winNode);
    this.windowNodes.delete(win);
    this.hiddenWindows.add(win);
    win.hide();
  }

  showWindow(win: WindowImpl) {
    if (this.hiddenWindows.has(win)) this.hiddenWindows.delete(win);
    const node = this.windowNodes.get(win);
    if (node == undefined) {
      if (!this.windows.isEmpty()) this.windows.last().obj.loseFocus();
      this.windowNodes.set(win, this.windows.push(win));
      this.updateZorder();
      win.show();
    } else if (this.windows.last() != node) {
      this.windows.last().obj.loseFocus();
      this.windows.remove(node);
      this.windows.insertNodeAfter(node);
      this.updateZorder();
      win.show();
    }
  }

  private updateZorder() {
    iter(this.windows).enumerate().forEach(([w, z]) => w.setZ(z));
  }

  getFooter(): Element {
    return this.footer;
  }

  getDesktop(): Element {
    return this.desktop;
  }

  getContent(): Element {
    return this.content;
  }

  switchWin() {
  }

  actionDescriptors(): ActionDescriptors {
    return this._actions;
  }

  block(...classes: string[]): Block {
    return new BlockImpl(document.createElement('div')).mod(clazz.add(...classes));
  }

  tag(tag: string, ...classes: string[]): Block {
    return new BlockImpl(document.createElement(tag)).mod(clazz.add(...classes));
  }

  row(rootClass = [], elemClass = [], root?: Block): Layout {
    return new LayoutImpl(
      () => this.block(),
      b => b.mod(clazz.add('row-block', ...rootClass)),
      b => b.mod(clazz.add('row-block-item', ...elemClass)),
      true,
      root
    )
  }

  column(rootClass = [], elemClass = [], root?: Block): Layout {
    return new LayoutImpl(
      () => this.block(),
      b => b.mod(clazz.add('column-block', ...rootClass)),
      b => b.mod(clazz.add('column-block-item', ...elemClass)),
      false,
      root
    )
  }
}

const BuildedUiConstructor: Plugin<Ui> = lifecycle(async (injector, lifecycle) => {
  const actions = await injector.getInstance(ACTION_DESCRIPTORS);
  const ui = new BuildedUi(actions);
  return ui;
});

export function PhotonUiModule(module: Module) {
  module.bind(UI, BuildedUiConstructor);
}