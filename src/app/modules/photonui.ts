import $, { ui } from "jquery";
import "jqueryui";
import h from "stage0";
import tippy from "tippy.js";
import { create, getInstances, instance, Module, Plugin, provider } from "../../utils/injector";
import { center, div, dragElement } from "../../utils/ui/ui";
import { Ui, UI, Window } from "../apis/ui";
import { Storages, STORAGES } from "app/apis/app";
import { Storage } from "app/apis/app";
import { WallStats } from "build/board/structs";
import { Element } from "../../utils/ui/ui";

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

  constructor(private id: string, private storage: Storage, private defState: WindowState, private desktop: HTMLElement) {
    const root = <HTMLElement>windowTemplate.cloneNode(true);
    const { window, head, content, footer } = windowTemplate.collect(root);

    this.winElement = window;
    this.contentElement = content;
    this.headerElement = head;
    this.footerElement = footer;

    desktop.appendChild(root);
    const jqw = $(root);
    jqw.draggable({
      handle: head, containment: desktop, snap: true, drag: async (e, ui) => {
        const state = await this.state;
        state.x = ui.position.left;
        state.y = ui.position.top;
        this.neetToSave = true;
      }
    });
    jqw.resizable({
      containment: desktop, resize: async (e, ui) => {
        const state = await this.state;
        state.width = ui.size.width;
        state.height = ui.size.height;
        this.neetToSave = true;
      }
    });
    jqw.hide();
    setInterval(() => this.saveState(), 1000);
    this.restoreState();
  }

  private async restoreState() {
    this.state = this.storage.get(this.id, this.defState);
    const state = await this.state;
    this.setSize(state.width, state.height);
    this.setPosition(state.x, state.y);
  }

  private async saveState() {
    if (!this.neetToSave) return;
    this.storage.set(this.id, await this.state);
    this.neetToSave = false;
  }

  public close() {
    this.hide();
    if (this.onclose) this.onclose();
  }

  hide() { $(this.winElement).hide() }
  async show() { await this.state; $(this.winElement).show() }

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

  destroy() { this.desktop.removeChild(this.winElement) }
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

class BuildedUi implements Ui {
  public head: Element;
  public content: Element;
  public footer: Element;
  public win: Element;

  constructor(
    private uiStorage: Storage
  ) {
    this.createDesktop();
  }

  createWindow(id: string, defw: number, defh: number): Window {
    const window = new BuildedWindow(id, this.uiStorage, this.createDefaultState(defw, defh), this.content.elem());
    return window;
  }

  private createDefaultState(width: number, height: number): WindowState {
    const maxw = document.body.clientWidth;
    const maxh = document.body.clientHeight;
    return { width, height, x: (maxw - width) / 2, y: (maxh - height) / 2 };
  }

  private createDesktop() {
    this.head = div('desktop-header');
    this.content = div('desktop-content');
    this.footer = div('desktop-footer');
    this.win = div('desktop')
      .append(this.head)
      .append(this.content)
      .append(this.footer);
    document.body.appendChild(this.win.elem());
  }
}

const BuildedUiConstructor: Plugin<Ui> = provider(async injector => {
  const [storages] = await getInstances(injector, STORAGES);
  const uiStorage = await storages('UI');
  return new BuildedUi(uiStorage);
});

export function PhotonUiModule(module: Module) {
  document.body.oncontextmenu = () => false;
  module.bind(UI, BuildedUiConstructor);
}