import { Injector } from "../../utils/injector";
import { UI, UiBuilder, Window, WindowBuilder, ToolbarBuilder, MenuBuilder } from "../apis/ui";
import { div, tag, dragElement, span, Element } from "../../utils/ui/ui";
import tippy from "tippy.js";

class PhotonWindow implements Window {
  public onclose: () => void;
  readonly contentElement: HTMLElement;
  readonly winElement: HTMLElement;
  private currentButtonGroup: Element;
  private toolbar: Element;

  constructor(id: string, title: string, w: number, h: number, draggable = false, centered = true, closeable = true) {
    const titleElem = tag('h1').className('title').text(title);
    const toolbar = div('toolbar-actions hidden');
    const header = tag('header').className('toolbar toolbar-header')
      .append(titleElem)
      .append(toolbar);
    if (closeable) {
      const close = span().className('icon icon-record pull-right padded-horizontally red').click(() => this.close());
      titleElem.append(close);
    }
    const footer = tag('footer').className('toolbar toolbar-footer');
    const content = div('window-content').size(w + 'px', h + 'px');
    const window = div('window-frame')
      .id(id)
      .append(header)
      .append(content)
      .append(footer);

    this.toolbar = toolbar;
    this.contentElement = content.elem();
    this.winElement = window.elem();
    if (centered) this.winElement.classList.add('fixed-center');
    if (draggable) dragElement(titleElem.elem(), this.winElement);
    document.body.appendChild(this.winElement);
  }

  public addToolMenuButton(icon: string, menu: MenuBuilder) {
    const container = this.currentButtonGroup == null
      ? this.toolbar
      : this.currentButtonGroup;
    const btn = tag('button').className('btn btn-default btn-dropdown').append(span().className('icon ' + icon));
    container.append(btn);
    menu.build(btn.elem());
    this.toolbar.elem().classList.remove('hidden');
  }

  public addToolIconButton(icon: string, click: () => void) {
    const container = this.currentButtonGroup == null
      ? this.toolbar
      : this.currentButtonGroup;
    container.append(
      tag('button').className('btn btn-default')
        .append(span().className('icon ' + icon))
        .click(click));
    this.toolbar.elem().classList.remove('hidden');
  }

  public addToolSearch(hint: string, change: (s: string) => void) {
    const container = this.currentButtonGroup == null
      ? this.toolbar
      : this.currentButtonGroup;
    const textBox = tag('input').className('toolbar-control')
      .attr('type', 'text')
      .attr('placeholder', hint)
      .change(change);
    container.append(
      tag('button').className('btn btn-default btn-mini pull-right')
        .append(span().className('icon icon-search'))
        .append(textBox)
        .click(() => { (<HTMLInputElement>textBox.elem()).value = ''; change('') }));
    this.toolbar.elem().classList.remove('hidden');
  }

  public startButtonGroup() {
    this.currentButtonGroup = div('btn-group');
    this.toolbar.append(this.currentButtonGroup);
  }

  public endButtonGroup() {
    this.currentButtonGroup = null;
  }

  public close() {
    this.hide();
    if (this.onclose) this.onclose();
  }

  show() { this.winElement.classList.remove('hidden') }
  hide() { this.winElement.classList.add('hidden') }
}

class PhotonWindowBuilder implements WindowBuilder {
  private _id: string;
  private _title: string;
  private _draggable = false;
  private _centered = true;
  private _closeable = true;
  private _onclose: () => void;
  private _w = 250;
  private _h = 250;
  private _toolbar: PhotonToolbarBuilder;

  public id(id: string) { this._id = id; return this }
  public title(title: string) { this._title = title; return this }
  public draggable(draggable: boolean) { this._draggable = draggable; return this }
  public centered(centered: boolean) { this._centered = centered; return this }
  public closeable(closeable: boolean) { this._closeable = closeable; return this }
  public onclose(h: () => void) { this._onclose = h; return this }
  public size(w: number, h: number) { this._w = w; this._h = h; return this }
  public toolbar(toolbar: PhotonToolbarBuilder) { this._toolbar = toolbar; return this }

  public build() {
    const win = new PhotonWindow(this._id, this._title, this._w, this._h, this._draggable, this._centered, this._closeable);
    win.onclose = this._onclose;
    if (this._toolbar) this._toolbar.build(win);
    return win;
  }
}

interface ToolbarItemBuilder { build(window: PhotonWindow): void }

class ToolbarGroupBuilder implements ToolbarItemBuilder {
  items: ToolbarItemBuilder[] = [];

  add(item: ToolbarItemBuilder) {
    this.items.push(item);
  }

  build(window: PhotonWindow): void {
    window.startButtonGroup();
    for (const i of this.items) i.build(window);
    window.endButtonGroup();
  }
}

class PhotonToolbarBuilder implements ToolbarBuilder {
  groups: ToolbarItemBuilder[] = [];
  currentGroup: ToolbarGroupBuilder = null;

  startGroup(): ToolbarBuilder {
    if (this.currentGroup != null) this.groups.push(this.currentGroup);
    this.currentGroup = new ToolbarGroupBuilder();
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

  button(icon: string, click: () => void): ToolbarBuilder {
    const item = { build(window: PhotonWindow) { window.addToolIconButton(icon, click) } };
    this.addItem(item);
    return this;
  }

  menuButton(icon: string, menu: MenuBuilder): ToolbarBuilder {
    const item = { build(window: PhotonWindow) { window.addToolMenuButton(icon, menu) } };
    this.addItem(item);
    return this;
  }

  search(hint: string, change: (s: string) => void): ToolbarBuilder {
    const item = { build(window: PhotonWindow) { window.addToolSearch(hint, change) } };
    this.addItem(item);
    return this;
  }

  build(window: PhotonWindow) {
    for (const group of this.groups) group.build(window);
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
    });
  }
}

class Builder implements UiBuilder {
  windowBuilder() { return new PhotonWindowBuilder() }
  toolbarBuilder() { return new PhotonToolbarBuilder() }
  menuBuilder() { return new PhotonMenuBuilder() }
}

export function PhotonUiModule(injector: Injector) {
  document.body.oncontextmenu = () => false;
  injector.bindInstance(UI, {
    builder: new Builder()
  });
}