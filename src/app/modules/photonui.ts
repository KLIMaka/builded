import h from "stage0";
import tippy from "tippy.js";
import { Module } from "../../utils/injector";
import { div, dragElement, span, tag } from "../../utils/ui/ui";
import { MenuBuilder, ToolbarBuilder, UI, UiBuilder, Window, WindowBuilder } from "../apis/ui";

const windowTemplate = h`
<div class="window-frame fixed-center hidden" #window>
  <header class="toolbar toolbar-header">
    <h1 class="title" #title>#caption
      <span class="icon icon-record pull-right padded-horizontally red hidden" #close></span>
    </h1>
    <div class="toolbar-actions hidden" #toolbar></div>
  </header>
  <div class="window-content" #content></div>
  <footer class="toolbar toolbar-footer">
      <div class="toolbar-actions hidden" #footer></div>
  </footer>
</div>
`;


class PhotonWindow implements Window {
  public onclose: () => void;
  readonly contentElement: HTMLElement;
  readonly winElement: HTMLElement;
  readonly toolbar: HTMLElement;
  readonly footerToolbar: HTMLElement;

  constructor(c: string, w: number, h: number, draggable = false, centered = true, closeable = true) {
    const root = <HTMLElement>windowTemplate.cloneNode(true);
    const { window, title, caption, close, toolbar, footer, content } = windowTemplate.collect(root);

    caption.nodeValue = c;
    if (closeable) {
      (<HTMLElement>close).classList.remove('hidden');
      (<HTMLElement>close).onclick = e => this.close();
    }

    this.winElement = window;
    this.contentElement = content;
    this.contentElement.style.width = w + 'px';
    this.contentElement.style.height = h + 'px';
    this.toolbar = toolbar;
    this.footerToolbar = footer;

    if (centered) this.winElement.classList.add('fixed-center');
    if (draggable) dragElement(title, this.winElement);
    document.body.appendChild(root);
  }

  public addToolbarWidget(currentGroup: HTMLElement, isToolbar: boolean, widget: HTMLElement) {
    const toolbar = isToolbar ? this.toolbar : this.footerToolbar;
    const container = currentGroup == null ? toolbar : currentGroup;
    container.appendChild(widget);
    toolbar.classList.remove('hidden');
  }

  public startButtonGroup(isToolbar: boolean) {
    const toolbar = isToolbar ? this.toolbar : this.footerToolbar;
    const group = div('btn-group').elem();
    toolbar.append(group);
    return group;
  }

  public close() {
    this.hide();
    if (this.onclose) this.onclose();
  }

  show() { this.winElement.classList.remove('hidden') }
  hide() { this.winElement.classList.add('hidden') }

  setPosition(x: string | number, y: string | number): void {
    const actualX = typeof x == 'number' ? x + 'px' : x;
    const actualY = typeof y == 'number' ? y + 'px' : y;
    this.winElement.style.left = actualX;
    this.winElement.style.top = actualY;
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
    const win = new PhotonWindow(this._title, this._w, this._h, this._draggable, this._centered, this._closeable);
    win.onclose = this._onclose;
    if (this._toolbar) this._toolbar.build(win);
    if (this._content) win.contentElement.appendChild(this._content);
    return win;
  }
}

const buttonTemplate = h`<button class="btn btn-default" #button></button>`;
const iconButtonTemplate = h`<button class="btn btn-default" #button><span class="icon" #icon></span></button>`;

interface ToolbarItemBuilder { build(window: PhotonWindow, group: HTMLElement): void }

class ToolbarGroupBuilder implements ToolbarItemBuilder {
  items: ToolbarItemBuilder[] = [];

  constructor(private isToolbar: boolean) { }

  add(item: ToolbarItemBuilder) {
    this.items.push(item);
  }

  build(window: PhotonWindow): void {
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
      build(window: PhotonWindow, group: HTMLElement) {
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
      build(window: PhotonWindow, group: HTMLElement) {
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
    const item = { build(window: PhotonWindow, group: HTMLElement) { window.addToolbarWidget(group, isToolbar, widget) } };
    this.addItem(item);
    return this;
  }

  build(window: PhotonWindow) {
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

class Builder implements UiBuilder {
  window() { return new PhotonWindowBuilder() }
  toolbar() { return new PhotonToolbarBuilder() }
  menu() { return new PhotonMenuBuilder() }
}

export function PhotonUiModule(module: Module) {
  document.body.oncontextmenu = () => false;
  module.bindInstance(UI, { builder: new Builder() });
}