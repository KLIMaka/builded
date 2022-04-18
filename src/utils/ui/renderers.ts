import h from "stage0";
import tippy, { Props } from "tippy.js";
import { MenuBuilder } from "../../app/apis/ui";
import { iter } from "../iter";
import { Handle, Oracle } from "./controls/api";
import { listBox } from "./controls/listbox";
import { FLOAT_MODEL, numberBox, NumberModel } from "./controls/numberbox";
import { Element, replaceContent, span, Table, tag } from "./ui";

export type ColumnRenderer<T> = (value: T) => Element;

export interface GridModel {
  rows(): Promise<Iterable<any[]>>;
  columns(): Iterable<ColumnRenderer<any>>;
  onClick(row: any[], rowElement: Element): void;
}

export type IconText = { text: string, icon: string, style: string };

export function IconTextRenderer(value: IconText): Element {
  const text = span().className('icon-text').text(value.text).css('margin-left', '5px');
  if (value.style != null) text.className(value.style);
  if (value.icon != null) text.append(span().className('icon pull-left ' + value.icon));
  return text;
}

export async function renderGrid(grid: GridModel): Promise<Element> {
  const table = new Table();
  table.className("table-striped");
  iter(await grid.rows()).forEach(dataRow => {
    const columns = [...iter(grid.columns()).enumerate().map(([r, i]) => r(dataRow[i]))];
    const row = table.row(columns);
    row.click(() => grid.onClick(dataRow, row));
  });
  return table;
}

export type NavItem = { icon: string, title: string };

export interface NavModel {
  readonly name: string;
  readonly items: NavItem[];
}

const navGroupTemplate = h`<nav class='nav-group'><h5 class='nav-group-title'>#navGroupTitleText</h5></nav>`;
const navGroupItemTemplate = h`<span class="nav-group-item"><span class="icon" #icon></span>#text</span>`;
export function renderNav(model: NavModel) {
  const root = <HTMLElement>navGroupTemplate.cloneNode(true);
  const { navGroupTitleText } = navGroupTemplate.collect(root);
  navGroupTitleText.nodeValue = model.name;
  for (const item of model.items) {
    const itemRoot = navGroupItemTemplate.cloneNode(true);
    const { icon, text } = navGroupItemTemplate.collect(itemRoot);
    text.nodeValue = item.title;
    icon.classList.add(item.icon);
    root.appendChild(itemRoot);
  }
  return root;
}

const paneGroupTemplate = h`<div class='pane-group'><div class='pane pane-sm sidebar' #sidebar></div><div class='pane' #main></div></div>`;
export function paneGroup() {
  const root = <HTMLElement>paneGroupTemplate.cloneNode(true);
  const { sidebar, main } = paneGroupTemplate.collect(root);
  return { root, sidebar, main };
}

export function menuButton(icon: string, menu: MenuBuilder): HTMLElement {
  const btn = tag('button').className('btn btn-default btn-dropdown').append(span().className('icon ' + icon));
  menu.build(btn.elem());
  return btn.elem();
}

export function widgetButton(icon: string, widget: HTMLElement): HTMLElement {
  const btn = tag('button').className('btn btn-default btn-dropdown').append(span().className('icon ' + icon)).elem();
  tippy(btn, widgetPopup(widget));
  return btn;
}



export type SliderModel = {
  label: string,
  model: NumberModel,
  handle: Handle<number>,
}

function setter<T>(handle: Handle<T>, validator: (v: T) => boolean) {
  return (v: T) => { if (validator(v)) handle.set(v) }
}

function wheelAction(handle: Handle<number>, set: (x: number) => void) {
  return (e: WheelEvent) => {
    const scale = e.altKey ? 0.1 : e.shiftKey ? 10 : 1;
    if (e.deltaY < 0) { set(handle.get() + scale); e.preventDefault() }
    if (e.deltaY > 0) { set(handle.get() - scale); e.preventDefault() }
  }
}

const widgetPopup = (widget: HTMLElement, opts = {}): Partial<Props> => {
  return {
    ...opts,
    content: widget,
    allowHTML: true,
    placement: 'bottom-start',
    trigger: 'click',
    interactive: true,
    arrow: false,
    offset: [0, 0],
    duration: 100,
    appendTo: document.body
  }
}

export function sliderToolbarButton(model: SliderModel) {
  const printLabel = () => `${model.label} ${model.model.formatter(model.handle.get())}`;
  const buttonTemplate = h`<button class="btn btn-default btn-dropdown">${printLabel()}</button>`;
  const widget = numberBox(model.handle, model.model);
  const btn = <HTMLElement>buttonTemplate.cloneNode(true);
  const inst = tippy(btn, widgetPopup(widget));
  model.handle.add(() => btn.textContent = printLabel());
  btn.onwheel = wheelAction(model.handle, setter(model.handle, model.model.validator));
  return btn;
}

export type NavItem1 = {
  title: string,
  setSelect: (cb: (select: boolean) => void) => void,
};

export type NavTreeModel = {
  title: string,
  items: NavItem1[],
  setOnCnange: (cb: () => void) => void,
  select: (item: NavItem1) => void;
};

const navGroupTemplate1 = h`<nav class='nav-group'><h5 class='nav-group-title'>#title</h5></nav>`;
const navGroupItemTemplate1 = h`<span class="nav-group-item" #navitem><span class="icon" #icon></span>#text</span>`;
export function navTree(root: HTMLElement, model: NavTreeModel): void {
  const render = () => {
    const group = <HTMLElement>navGroupTemplate1.cloneNode(true);
    const { title } = navGroupTemplate1.collect(group);
    title.nodeValue = model.title;
    for (const item of model.items) {
      const itemRoot = navGroupItemTemplate1.cloneNode(true);
      const { icon, text, navitem } = navGroupItemTemplate1.collect(itemRoot);
      text.nodeValue = item.title;
      icon.classList.add('icon-record');
      navitem.onclick = _ => model.select(item);
      item.setSelect(s => { if (s) navitem.classList.add('active'); else navitem.classList.remove('active') });
      group.appendChild(itemRoot);
    }
    replaceContent(root, group);
  }
  render();
  model.setOnCnange(render);
}

export type Property = {
  label: string,
  widget: HTMLElement
}

function listWidget(oracle: Oracle<string>, handle: Handle<string>): HTMLElement {
  return listBox('', null, oracle, handle);
}

export function rangeProp(label: string, handle: Handle<number>, model: NumberModel = FLOAT_MODEL): Property {
  return widgetProp(label, numberBox(handle, model));
}

export function listProp(label: string, oracle: Oracle<string>, handle: Handle<string>): Property {
  return widgetProp(label, listWidget(oracle, handle));
}

export function widgetProp(label: string, widget: HTMLElement): Property {
  return { label, widget };
}

const propertiesTemplate = h`<div class="properties"></div>`;
const propertyLabel = h`<div class="label"><span>#label</span></div>`
const propertyWidget = h`<div class="widget"></div>`;
export function properties(properties: Property[]): HTMLElement {
  const props = <HTMLElement>propertiesTemplate.cloneNode(true);
  for (const p of properties) {
    const labelRoot = propertyLabel.cloneNode(true);
    const { label } = propertyLabel.collect(labelRoot);
    const widgetRoot = propertyWidget.cloneNode(true);
    label.nodeValue = p.label;
    widgetRoot.appendChild(p.widget);
    props.appendChild(labelRoot);
    props.appendChild(widgetRoot);
  }
  return props;
}

const closeableTemplate = h`<div class="closeable"><div class="title">#title</div><div class="container" #container></div></div>`;
export function closeable(label: string, closed: boolean) {
  const root = <HTMLElement>closeableTemplate.cloneNode(true);
  const { title, container } = closeableTemplate.collect(root);
  title.nodeValue = label;
  const toggle = () => {
    closed = !closed;
    if (closed) root.classList.add('closed');
    else root.classList.remove('closed')
  }
  title.onlick = toggle();
  return { root, container };
}
