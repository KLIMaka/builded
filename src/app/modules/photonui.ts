import $, { ui } from "jquery";
import "jqueryui";
import h from "stage0";
import tippy from "tippy.js";
import { create, getInstances, instance, lifecycle, Module, Plugin, provider } from "../../utils/injector";
import { center, div, dragElement } from "../../utils/ui/ui";
import { Ui, UI, Window } from "../apis/ui";
import { State, STATE, Storages, STORAGES } from "app/apis/app";
import { Storage } from "app/apis/app";
import { Element } from "../../utils/ui/ui";
import { enumerate, forEach } from "utils/collections";
import { BUS, Message, MessageBus, MessageHandler, MessageHandlerReflective } from "app/apis/handler";
import { INPUT } from "./default/input";
import { Key } from "app/edit/messages";
import { Input } from "app/input/keymap";

const dialogTemplate = h`
<div class="window-frame hidden" #window>
  <header class="toolbar toolbar-header">
  <h1 class="title" #title>#caption_
    <span class="icon icon-record pull-right padded-horizontally red" #close></span>
  </h1>
  </header>
  <div class="window-content" #content></div>
  <div class="dialog-buttons">
    <button class="btn btn-default" #cancel>Cancel</button>
    <button class="btn btn-primary" #ok>OK</button>
  </div>
</div>
`;

export class PhotonDialog implements Window {
  public onclose = () => { };
  public onok = () => { };
  readonly contentElement: HTMLElement;
  readonly winElement: HTMLElement;

  constructor(caption: string) {
    const root = <HTMLElement>dialogTemplate.cloneNode(true);
    const { window, title, caption_, close, content, ok, cancel } = dialogTemplate.collect(root);
    close.onclick = cancel.onclick = _ => this.close();
    ok.onclick = () => this.onok();
    caption_.nodeValue = caption;
    this.winElement = window;
    this.contentElement = content;
    dragElement(title, this.winElement);
    center(document.body, this.winElement, 300, 100);
    document.body.appendChild(root);
  }

  hide() { this.winElement.classList.add('hidden') }
  show() { this.winElement.classList.remove('hidden') }
  destroy() { document.body.removeChild(this.winElement) }

  public close() {
    this.hide();
    this.onclose();
  }

  setPosition(x: string | number, y: string | number): void { }
}

const windowTemplate = h`
<div class="window" style="position:absolute;" #window>
  <div class="window-head" #head></div>
  <div class="window-content" #content></div>
  <div class="window-footer" #footer></div>
</div>
`;

type WindowState = {
  x: number,
  y: number,
  width: number,
  height: number
}


class BuildedWindow implements Window {
  public onclose: () => void;
  readonly contentElement: HTMLElement;
  readonly winElement: HTMLElement;
  readonly headerElement: HTMLElement;
  readonly footerElement: HTMLElement;
  private state: Promise<WindowState>;
  private neetToSave = false;
  private handlers: MessageHandler[] = [];

  constructor(private ui: BuildedUi, private id: string, defw: number, defh: number) {
    const root = <HTMLElement>windowTemplate.cloneNode(true);
    const { window, head, content, footer } = windowTemplate.collect(root);

    this.winElement = window;
    this.contentElement = content;
    this.headerElement = head;
    this.footerElement = footer;

    this.ui.getDesktop().appendHtml(root);
    const jqw = $(root);
    jqw.draggable({
      handle: head, containment: this.ui.getContent().elem(), snap: true, drag: async (e, ui) => {
        const state = await this.state;
        state.x = ui.position.left;
        state.y = ui.position.top;
        this.neetToSave = true;
      }
    });
    jqw.resizable({
      containment: this.ui.getContent().elem(), resize: async (e, ui) => {
        const state = await this.state;
        state.width = ui.size.width;
        state.height = ui.size.height;
        this.neetToSave = true;
      }
    });
    jqw.hide();
    setInterval(() => this.saveState(), 1000);
    this.winElement.addEventListener('mousedown', e => this.ui.bringToFront(this));
    this.restoreState(defw, defh);
  }

  private async restoreState(w: number, h: number) {
    this.state = this.ui.storage.get(this.id, this.ui.createDefaultState(w, h));
    const state = await this.state;
    this.setSize(state.width, state.height);
    this.setPosition(state.x, state.y);
  }

  private async saveState() {
    if (!this.neetToSave) return;
    this.ui.storage.set(this.id, await this.state);
    this.neetToSave = false;
  }

  public close() {
    this.hide();
    if (this.onclose) this.onclose();
  }

  hide() { $(this.winElement).hide() }
  async show() { await this.state; $(this.winElement).show(); this.ui.bringToFront(this); }
  async setZ(z: number) { this.winElement.style.zIndex = `${z}` }
  getZ() { return this.winElement.style.zIndex }

  async setSize(w: number, h: number) {
    this.winElement.style.width = `${w}px`;
    this.winElement.style.height = `${h}px`;
    const state = await this.state;
    state.height = h;
    state.width = w;
    this.neetToSave = true;
  }

  async setPosition(x: number, y: number) {
    this.winElement.style.left = `${x}px`;
    this.winElement.style.top = `${y}px`;
    const state = await this.state;
    state.x = x;
    state.y = y;
    this.neetToSave = true;
  }

  destroy() { this.ui.getDesktop().elem().removeChild(this.winElement) }

  public handle(msg: Message): void {
    this.handlers.forEach(h => h.handle(msg));
  }

  addHandler(handler: MessageHandler): void {
    this.handlers.push(handler);
  }
}

class PhotonWindowBuilder implements WindowBuilder {
  private _title: string;
  private _draggable = false;
  private _centered = true;
  private _closeable = true;
  private _onclose: () => void;
  private _w = 250;
  private _h = 250;
  private _toolbar: PhotonToolbarBuilder;
  private _content: HTMLElement;

  public title(title: string) { this._title = title; return this }
  public draggable(draggable: boolean) { this._draggable = draggable; return this }
  public centered(centered: boolean) { this._centered = centered; return this }
  public closeable(closeable: boolean) { this._closeable = closeable; return this }
  public onclose(h: () => void) { this._onclose = h; return this }
  public size(w: number, h: number) { this._w = w; this._h = h; return this }
  public toolbar(toolbar: PhotonToolbarBuilder) { this._toolbar = toolbar; return this }
  public content(content: HTMLElement) { this._content = content; return this; }

  public build() {
    const win = new BuildedWindow(this._title, this._w, this._h, this._centered, this._closeable);
    win.onclose = this._onclose;
    if (this._toolbar) this._toolbar.build(win);
    if (this._content) win.contentElement.appendChild(this._content);
    return win;
  }
}

const buttonTemplate = h`<button class="btn btn-default" #button></button>`;
const iconButtonTemplate = h`<button class="btn btn-default" #button><span class="icon" #icon></span></button>`;

interface ToolbarItemBuilder { build(window: BuildedWindow, group: HTMLElement): void }

class ToolbarGroupBuilder implements ToolbarItemBuilder {
  items: ToolbarItemBuilder[] = [];

  constructor(private isToolbar: boolean) { }

  add(item: ToolbarItemBuilder) {
    this.items.push(item);
  }

  build(window: BuildedWindow): void {
    const group = window.startButtonGroup(this.isToolbar);
    for (const i of this.items) i.build(window, group);
  }
}

class PhotonToolbarBuilder implements ToolbarBuilder {
  groups: ToolbarItemBuilder[] = [];
  currentGroup: ToolbarGroupBuilder = null;
  isToolbar = true;

  footer() { this, this.isToolbar = false; return this; }

  startGroup(): ToolbarBuilder {
    if (this.currentGroup != null) this.groups.push(this.currentGroup);
    this.currentGroup = new ToolbarGroupBuilder(this.isToolbar);
    return this;
  }

  endGroup(): ToolbarBuilder {
    this.groups.push(this.currentGroup);
    this.currentGroup = null;
    return this;
  }

  private addItem(item: ToolbarItemBuilder) {
    if (this.currentGroup == null) this.groups.push(item);
    else this.currentGroup.add(item);
  }

  button(caption: string, click: () => void): ToolbarBuilder {
    const isToolbar = this.isToolbar;
    const item = {
      build(window: BuildedWindow, group: HTMLElement) {
        const root = <HTMLElement>buttonTemplate.cloneNode(true);
        const { button } = buttonTemplate.collect(root);
        button.onclick = click;
        button.text = caption;
        window.addToolbarWidget(group, isToolbar, root);
      }
    };
    this.addItem(item);
    return this;
  }

  iconButton(i: string, click: () => void): ToolbarBuilder {
    const isToolbar = this.isToolbar;
    const item = {
      build(window: BuildedWindow, group: HTMLElement) {
        const root = <HTMLElement>iconButtonTemplate.cloneNode(true);
        const { button, icon } = iconButtonTemplate.collect(root);
        button.onclick = click;
        icon.classList.add(i);
        window.addToolbarWidget(group, isToolbar, root);
      }
    };
    this.addItem(item);
    return this;
  }

  widget(widget: HTMLElement): ToolbarBuilder {
    const isToolbar = this.isToolbar;
    const item = { build(window: BuildedWindow, group: HTMLElement) { window.addToolbarWidget(group, isToolbar, widget) } };
    this.addItem(item);
    return this;
  }

  build(window: BuildedWindow) {
    for (const group of this.groups) group.build(window, null);
  }
}

class PhotonMenuBuilder implements MenuBuilder {
  private items: [string, () => void][] = [];

  item(text: string, click: () => void): MenuBuilder {
    this.items.push([text, click]);
    return this;
  }

  build(elem: HTMLElement) {
    const menu = div('menu menu-default');
    let instance = null;
    for (const [label, click] of this.items) menu.append(div('menu-item').text(label).click(() => { click(), instance.hide(); }));
    instance = tippy(elem, {
      content: menu.elem(),
      allowHTML: true,
      placement: 'bottom-start',
      trigger: 'click',
      interactive: true,
      arrow: false,
      offset: [0, 0],
      duration: 100,
      appendTo: document.body
    });
  }
}

type WinzTuple = [BuildedWindow, number];
function zSorter(topWin: BuildedWindow) {
  return (lh: WinzTuple, rh: WinzTuple) => { return lh[0] == topWin ? 1 : rh[0] == topWin ? -1 : lh[1] - rh[1] }
}

class BuildedUi implements Ui {
  private head: Element;
  private content: Element;
  private footer: Element;
  private desktop: Element;
  private windows: BuildedWindow[] = [];
  private currentWindow: BuildedWindow;

  constructor(
    public storage: Storage,
    private bus: MessageBus,
    private input: Input,
    private state: State,
  ) {
    this.createDesktop();
    this.addEventListeners();
  }

  handle(msg: Message): void {
    
  }

  createWindow(id: string, defw: number, defh: number): Window {
    const window = new BuildedWindow(this, id, defw, defh);
    this.windows.push(window);
    return window;
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

  createDefaultState(width: number, height: number): WindowState {
    const maxw = this.content.elem().clientWidth;
    const maxh = this.content.elem().clientHeight;
    return { width, height, x: (maxw - width) / 2, y: (maxh - height) / 2 };
  }

  bringToFront(win: BuildedWindow) {
    const winzs = this.windows.map(w => [w, parseInt(w.getZ())] as WinzTuple).sort(zSorter(win));
    forEach(enumerate(winzs), ([[w,], i]) => w.setZ(i));
    this.currentWindow = win;
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

  private addEventListeners() {
    // const consumer = this.input.get('desktop');
    // const kbe = (handler: (key: string) => void) => (e: KeyboardEvent) => {
    //   handler(e.key.toLowerCase());
    //   e.preventDefault();
    //   return false;
    // }
    // const keyup = kbe(key => forEach(consumer.transform(new Key(key, false), this.state), e => this.bus.handle(e)));
    // const keydown = kbe(key => forEach(consumer.transform(new Key(key, true), this.state), e => this.bus.handle(e)));
    // document.body.addEventListener('keydown', keydown);
    // document.body.addEventListener('keyup', keyup);

    document.body.addEventListener('contextmenu', e => e.preventDefault());
    this.input.connect('desktop', ms => ms.forEach(m => this.currentWindow.handle(m)));
  }
}

const BuildedUiConstructor: Plugin<Ui> = lifecycle(async (injector, lifecycle) => {
  const [storages, bus, input, state] = await getInstances(injector, STORAGES, BUS, INPUT, STATE);
  const uiStorage = await storages('UI');
  const ui = new BuildedUi(uiStorage, bus, input, state);
  lifecycle(bus.connect(ui), async h => bus.disconnect(h));
  return ui;
});

export function PhotonUiModule(module: Module) {
  module.bind(UI, BuildedUiConstructor);
}