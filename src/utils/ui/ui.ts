import { Consumer } from "ts-utils/types";


export class Element {
  constructor(private element: HTMLElement) { }

  public className(name: string): Element {
    this.element.className = name;
    return this;
  }

  public id(id: string): Element {
    this.element.id = id;
    return this;
  }

  public text(text: string): Element {
    this.element.textContent = text;
    return this;
  }

  public appendHtml(html: HTMLElement): Element {
    this.element.appendChild(html);
    return this;
  }

  public append(element: Element): Element {
    this.element.appendChild(element.element);
    return this;
  }

  public before(element: Element): Element {
    this.element.before(element.element);
    return this;
  }

  public appendText(text: string): Element {
    this.element.appendChild(document.createTextNode(text));
    return this;
  }

  public pos(x: string, y: string): Element {
    this.element.style.left = x;
    this.element.style.top = y;
    return this;
  }

  public size(w: string, h: string): Element {
    this.element.style.width = w;
    this.element.style.height = h;
    return this;
  }

  public width(w: string): Element {
    this.element.style.width = w;
    return this;
  }

  public height(h: string): Element {
    this.element.style.height = h;
    return this;
  }

  public elem(): HTMLElement {
    return this.element;
  }

  public attr(name: string, val: any): Element {
    this.element.setAttribute(name, val);
    return this;
  }

  public css(name: string, val: any): Element {
    this.element.style[name] = val;
    return this;
  }

  public styles(): CSSStyleDeclaration {
    return this.element.style;
  }

  public classList(): DOMTokenList {
    return this.element.classList;
  }

  public addEvent<K extends keyof HTMLElementEventMap>(type: K, listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any): Element {
    this.element.addEventListener(type, listener);
    return this;
  }

  public click(e: () => void): Element {
    this.element.onclick = e;
    return this;
  }

  public next(nth = 0): Element {
    let next = this.element.nextElementSibling;
    for (; next != null && nth > 0; next = next.nextElementSibling, nth--);
    return next == null ? null : new Element(next as HTMLElement);
  }

  public nextValid(nth = 0): Element {
    let next: globalThis.Element = this.element;
    for (; next != null && nth >= 0 && next.nextElementSibling != null; next = next.nextElementSibling, nth--);
    return next === this.element ? this : new Element(next as HTMLElement);
  }

  public prev(nth = 0): Element {
    let prev = this.element.previousElementSibling;
    for (; prev != null && nth > 0; prev = prev.previousElementSibling, nth--);
    return prev == null ? null : new Element(prev as HTMLElement);
  }

  public prevValid(nth = 0): Element {
    let prev: globalThis.Element = this.element;
    for (; prev != null && nth >= 0 && prev.previousElementSibling != null; prev = prev.previousElementSibling, nth--);
    return prev === this.element ? this : new Element(prev as HTMLElement);
  }

  public child(): Element {
    const child = this.element.firstElementChild;
    return child == null ? null : new Element(child as HTMLElement);
  }

  public change(cb: (s: string) => void): Element {
    this.element.oninput = (e) => {
      cb((e.target as HTMLInputElement).value);
    };
    return this;
  }

  public clearChildren() {
    this.element.replaceChildren();
  }
}

function create(tag: string) {
  return document.createElement(tag);
}

export function tag(tag: string): Element {
  return new Element(create(tag));
}

export function div(className: string): Element {
  return new Element(create('div')).className(className);
}

export function span(): Element {
  return new Element(create('span'))
}

export function label(text: string): Element {
  return div('label').text(text);
}

export function button(caption: string): Element {
  return div('contour').append(div('button').text(caption));
}

export type DragConsumer = (dx: number, dy: number) => void;
export function dragElement(elem: HTMLElement, cursor: string, dragConsumer: DragConsumer, startDragConsumer: Consumer<void>, endDragConsumer: Consumer<void>, clickConsumer: Consumer<void>) {
  let started = false;
  let startx = 0;
  let starty = 0;
  let onmouseup = null;
  let onmousemove = null;
  elem.onmousedown = startDrag;

  function startDrag(e: MouseEvent) {
    e.preventDefault();
    startx = e.clientX;
    starty = e.clientY;
    started = false;
    onmouseup = document.onmouseup;
    onmousemove = document.onmousemove;
    document.onmouseup = endDrag;
    document.onmousemove = drag;
    document.body.style.setProperty('cursor', cursor, 'important');
  }

  function drag(e: MouseEvent) {
    e.preventDefault();
    const dx = startx - e.clientX;
    const dy = starty - e.clientY;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      started = true;
      startDragConsumer();
    }
    if (started) dragConsumer(dx, dy);
  }

  function endDrag(e: MouseEvent) {
    e.preventDefault();
    document.onmouseup = onmouseup;
    document.onmousemove = onmousemove;
    document.body.style.cursor = 'default';
    endDragConsumer();
    if (!started) clickConsumer();
  }
}

export function closeModal<T>(window: HTMLElement, cb: (v: T) => void, value: T) {
  window.classList.add('hidden');
  cb(value);
}

export function stopPropagation(e: Event) {
  e.stopPropagation();
  e.preventDefault();
}

export function addDragAndDrop(elem: HTMLElement, dropHandler: (e: DragEvent) => void) {
  elem.addEventListener("dragenter", stopPropagation, false);
  elem.addEventListener("dragover", stopPropagation, false);
  elem.addEventListener("drop", (e) => { stopPropagation(e); dropHandler(e); }, false);
}

export function replaceContent(root: HTMLElement, newchild: HTMLElement) {
  const child = root.firstChild;
  if (child) root.replaceChild(newchild, child);
  else root.appendChild(newchild);
}

export type DragController = (posx: number, posy: number, dx: number, dy: number, dscale: number) => void;

export function addDragController(elem: HTMLElement, controller: DragController) {
  elem.addEventListener('wheel', e => {
    if (e.deltaY > 0) controller(e.x, e.y, 0, 0, 1 / 1.1);
    if (e.deltaY < 0) controller(e.x, e.y, 0, 0, 1.1);
  });
  let isDrag = false;
  let oldx = 0;
  let oldy = 0;
  elem.addEventListener('mousemove', e => {
    isDrag = e.buttons === 2;
    if (isDrag) {
      const dx = e.x - oldx;
      const dy = e.y - oldy;
      if (dx !== 0 || dy !== 0) controller(e.x, e.y, dx, dy, 1);
    }
    oldx = e.x;
    oldy = e.y;
  });
}

export function center(parent: HTMLElement, child: HTMLElement, width: number, height: number) {
  const winH = parent.clientHeight;
  const winW = parent.clientWidth;
  child.style.top = (winH - height) / 2 + 'px';
  child.style.left = (winW - width) / 2 + 'px';
}

export class AutoScroller {
  private observer: IntersectionObserver;
  private needToScroll = false;
  private lastElemet: HTMLElement;

  constructor(root: HTMLElement) {
    this.observer = new IntersectionObserver((e, o) => this.observerCallback(e, o), { root: root });
  }

  private observerCallback(entries: IntersectionObserverEntry[], _: IntersectionObserver) {
    if (!this.needToScroll) return;
    const e = entries[0];
    if (e.intersectionRect.height >= e.boundingClientRect.height) return;
    e.target.scrollIntoView(e.boundingClientRect.top < e.rootBounds.top);
    this.needToScroll = false;
  }

  show(elem: HTMLElement) {
    if (this.lastElemet) this.observer.unobserve(this.lastElemet);
    this.needToScroll = true;
    this.observer.observe(elem);
    this.lastElemet = elem;
  }
}