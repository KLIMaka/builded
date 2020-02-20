import { Injector } from "../../utils/injector";
import { UI, UiBuilder, Window, WindowBuilder } from "../apis/ui";
import { div, tag, dragElement, span, Element } from "../../utils/ui/ui";

class PhotonWindow implements Window {
  public onclose: () => void;
  readonly contentElement: HTMLElement;
  readonly winElement: HTMLElement;
  private buttongroup: Element;
  private toolbar: Element;

  constructor(id: string, title: string, w: number, h: number, draggable = false, centered = true, closeable = true) {
    const titleElem = tag('h1').className('title').text(title);
    const buttongroup = div('btn-group');
    const toolbar = div('toolbar-actions hidden').append(buttongroup);
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
    this.buttongroup = buttongroup;
    this.contentElement = content.elem();
    this.winElement = window.elem();
    if (centered) this.winElement.classList.add('fixed-center');
    if (draggable) dragElement(titleElem.elem(), this.winElement);
    document.body.appendChild(this.winElement);
  }

  public addToolIconButton(icon: string, click: () => void) {
    this.buttongroup.append(
      tag('button').className('btn btn-default')
        .append(span().className('icon ' + icon))
        .click(click));
    this.toolbar.elem().classList.remove('hidden');
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
  private _toolbar: [string, () => void][] = [];

  public id(id: string) { this._id = id; return this }
  public title(title: string) { this._title = title; return this }
  public draggable(draggable: boolean) { this._draggable = draggable; return this }
  public centered(centered: boolean) { this._centered = centered; return this }
  public closeable(closeable: boolean) { this._closeable = closeable; return this }
  public onclose(h: () => void) { this._onclose = h; return this }
  public size(w: number, h: number) { this._w = w; this._h = h; return this }
  public toolbar(icon: string, click: () => void) { this._toolbar.push([icon, click]); return this }

  public build() {
    const win = new PhotonWindow(this._id, this._title, this._w, this._h, this._draggable, this._centered, this._closeable);
    win.onclose = this._onclose;
    for (const [icon, click] of this._toolbar) win.addToolIconButton(icon, click);
    return win;
  }
}

class Builder implements UiBuilder {
  windowBuilder() { return new PhotonWindowBuilder() }
}

export function PhotonUiModule(injector: Injector) {
  document.body.oncontextmenu = () => false;
  injector.bindInstance(UI, {
    builder: new Builder()
  });
}