

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

  public click(e: () => void): Element {
    this.element.onclick = e;
    return this;
  }

  public change(cb: (s: string) => void): Element {
    this.element.oninput = (e) => {
      cb((<HTMLInputElement>e.target).value);
    };
    return this;
  }
}

function create(tag: string) {
  return document.createElement(tag);
}

export class Table extends Element {
  private tbody: Element;
  private thead: Element;

  constructor() {
    super(create('table'));
    this.thead = new Element(create('thead'));
    this.tbody = new Element(create('tbody'));
    this.append(this.thead);
    this.append(this.tbody);
  }

  public head(cols: Element[]): Table {
    let tr = new Element(create('tr'));
    for (let i = 0; i < cols.length; i++) {
      let c = cols[i];
      let td = new Element(create('th')).append(c);
      tr.append(td);
    }
    this.thead.append(tr);
    return this;
  }

  public row(cols: Element[]): Element {
    let tr = new Element(create('tr'));
    for (let i = 0; i < cols.length; i++) {
      let c = cols[i];
      let td = new Element(create('td')).append(c);
      tr.append(td);
    }
    this.tbody.append(tr);
    return tr;
  }

  public removeRow(row: number): Table {
    (<HTMLTableElement>this.tbody.elem()).deleteRow(row);
    return this;
  }
}

export declare module Object {
  export function keys(obj: any): any;
}

export class Properties extends Table {
  private labels: any = {};

  constructor() {
    super();
    this.className('props');
  }

  public prop(name: string, el: Element): Properties {
    this.row([div('property_name').text(name), el]);
    return this;
  }

  public refresh(props: any): Properties {
    let fields = Object.keys(props);
    for (let i = 0; i < fields.length; i++) {
      let field = fields[i];
      let l = this.labels[field];
      if (l == undefined) {
        l = label('');
        this.labels[field] = l;
        this.prop(field, l);
      }
      l.text(props[field] + '');
    }
    return this;
  }
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

export function table(): Table {
  return new Table();
}

export function props(): Properties {
  return new Properties();
}

export function label(text: string): Element {
  return div('label').text(text);
}

export function button(caption: string): Element {
  return div('contour').append(div('button').text(caption));
}

export function panel(title: string): Element {
  return div('frame')
    .append(div('header').text(title))
    .append(div('hline'))
    .append(div('content'));
}

export class Progress extends Element {
  private title: Element;
  private progress: Element;

  constructor(title: string, max: number = 100) {
    super(create('div'));
    this.title = div('title').text(title);
    this.progress = new Element(create('progress')).attr('max', max);
    this.append(this.title).append(this.progress);
  }

  public max(max: number): Progress {
    this.progress.attr('max', max);
    return this;
  }

  public setValue(val: number): Progress {
    this.progress.attr('value', val);
    return this;
  }
}

export function progress(title: string, max: number = 100) {
  return new Progress(title, max);
}

export class VerticalPanel extends Element {
  private rows = 0;
  constructor(className: string) {
    super(create('div'));
    this.className(className);
  }

  public add(elem: Element): number {
    this.append(elem);
    return this.rows++;
  }
}

export function verticalPanel(className: string): VerticalPanel {
  return new VerticalPanel(className);
}

export function dragElement(header: HTMLElement, elment: HTMLElement) {
  let startx = 0;
  let starty = 0;
  let onmouseup = null;
  let onmousemove = null;
  header.onmousedown = dragMouseDown;

  function dragMouseDown(e: MouseEvent) {
    e.preventDefault();
    startx = e.clientX;
    starty = e.clientY;
    onmouseup = document.onmouseup;
    onmousemove = document.onmousemove;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e: MouseEvent) {
    e.preventDefault();
    let x = startx - e.clientX;
    let y = starty - e.clientY;
    startx = e.clientX;
    starty = e.clientY;
    elment.style.top = (elment.offsetTop - y) + "px";
    elment.style.left = (elment.offsetLeft - x) + "px";
  }

  function closeDragElement() {
    document.onmouseup = onmouseup;
    document.onmousemove = onmousemove;
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
  elem.addEventListener("drop", (e) => {
    stopPropagation(e);
    dropHandler(e);
  }, false);
}

export function replaceContent(root: HTMLElement, newchild: HTMLElement) {
  const child = root.firstChild;
  if (child) root.replaceChild(newchild, child);
  else root.appendChild(newchild);
}

export type DragController = (dx: number, dy: number, dscale: number) => void;

export function addDragController(elem: HTMLElement, controller: DragController) {
  elem.addEventListener('wheel', e => {
    if (e.deltaY > 0) controller(0, 0, 0.9);
    if (e.deltaY < 0) controller(0, 0, 1.1);
  });
  let isDrag = false;
  let oldx = 0;
  let oldy = 0;
  elem.addEventListener('mousemove', e => {
    if (isDrag) {
      const dx = e.x - oldx;
      const dy = e.y - oldy;
      if (dx != 0 || dy != 0) controller(dx, dy, 1);
    }
    oldx = e.x;
    oldy = e.y;
  });
  elem.addEventListener('mousedown', e => isDrag = true);
  elem.addEventListener('mouseup', e => isDrag = false);
}