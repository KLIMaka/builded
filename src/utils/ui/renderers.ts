import tippy, { Props } from "tippy.js";
import { MenuBuilder } from "../../app/apis/ui";
import { iter } from "../iter";
import { div, Element, Properties, replaceContent, span, Table, tag } from "./ui";
import h from "stage0";
import { map, take } from "../collections";
import { CallbackChannel, CallbackChannelImpl, CallbackHandle, Destenation, Source } from "../callbacks";
import { BasicValue } from "../value";

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

interface SuggestionModel {
  readonly widget: HTMLElement,
  shift(d: number): void;
  select(): void;
}

const suggestTemplate = h`
<button class="btn btn-default btn-mini dropdown-list" #button>
  <span class="icon hidden" #icon></span>
  <input type="text" class="toolbar-control" #input>
</button>
`;

export type Oracle<T> = (s: string) => Iterable<T>;
export type Handle<T> = Source<T> & Destenation<T> & CallbackChannel<[]>;

export function search(hint: string, ico: string, oracle: Oracle<string>, handle: Handle<string>, trackInput = false): HTMLElement {
  const root = suggestTemplate.cloneNode(true);
  const { button, input, icon } = suggestTemplate.collect(root);
  if (ico != null) {
    icon.classList.remove('hidden');
    icon.classList.add(ico);
  }
  if (!trackInput) button.classList.add('btn-dropdown');
  const suggestContainer = div('suggest').elem();
  let suggestModel: SuggestionModel = null;
  const suggestions = menu(input, suggestContainer);
  suggestions.setProps({ onHide: () => { input.value = handle.get() } })
  handle.add(() => { input.value = handle.get(); suggestions.hide(); });
  const update = (items: Iterable<string>) => {
    suggestModel = sugggestionsMenu(map(items, (i: string) => <[string, () => void]>[i, () => handle.set(i)]));
    replaceContent(suggestContainer, suggestModel.widget);
    suggestions.show();
  }
  input.oninput = () => { if (trackInput) handle.set(input.value); update(oracle(input.value)); }
  input.placeholder = hint;
  input.value = handle.get();
  input.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key == 'ArrowDown') suggestModel.shift(1)
    else if (e.key == 'ArrowUp') suggestModel.shift(-1)
    else if (e.key == 'Enter') suggestModel.select()
    else if (e.key == 'Escape') suggestions.hide()
  });
  button.onclick = () => update(oracle(''));
  return button;
}

const EMPTY_SUGGESTIONS: SuggestionModel = {
  widget: div('hidden').elem(),
  shift: (d: number) => { },
  select: () => { }
}

function sugggestionsMenu(items: Iterable<[string, () => void]>): SuggestionModel {
  const menu = div('menu menu-default');
  let selected = 0;
  const options: [Element, () => void][] = [];
  for (const [label, click] of items) {
    const item = div('menu-item').text(label).click(() => click());
    options.push([item, click]);
    menu.append(item);
  }
  if (options.length == 0) return EMPTY_SUGGESTIONS;
  const select = (newSelected: number) => {
    options[selected][0].elem().classList.remove('selected');
    options[newSelected][0].elem().classList.add('selected');
    selected = newSelected;
  }
  // select(0);
  return {
    widget: menu.elem(),
    shift(d: number) { select(Math.min(Math.max(0, selected + d), options.length - 1)) },
    select() { options[selected][1]() }
  }
}

function menu(input: HTMLElement, suggestContainer: HTMLElement) {
  return tippy(input, {
    allowHTML: true,
    placement: 'bottom-start',
    interactive: true,
    content: suggestContainer,
    trigger: 'focus',
    arrow: false,
    offset: [0, 0],
    appendTo: document.body
  });
}


export type SliderModel = {
  label: string,
  value: BasicValue<number>,
  handle: Handle<number>,
}

function setter<T>(handle: Handle<T>, value: BasicValue<T>) {
  return (v: T) => {
    if (!value.validator(v)) return;
    handle.set(v);
  }
}

function wheelAction(handle: Handle<number>, set: (x: number) => void) {
  return (e: WheelEvent) => {
    const scale = e.altKey ? 0.1 : e.shiftKey ? 10 : 1;
    if (e.deltaY < 0) { set(handle.get() + scale); e.preventDefault() }
    if (e.deltaY > 0) { set(handle.get() - scale); e.preventDefault() }
  }
}

function arrowAction(handle: Handle<number>, set: (x: number) => void) {
  return (e: KeyboardEvent) => {
    const scale = e.altKey ? 0.1 : e.shiftKey ? 10 : 1;
    if (e.code == 'ArrowUp') { set(handle.get() + scale); e.preventDefault() }
    if (e.code == 'ArrowDown') { set(handle.get() - scale); e.preventDefault() }
  }
}

export function numberBox(handle: Handle<number>, value: BasicValue<number>): HTMLElement {
  const boxTemplate = h`<div class="popup-widget"><input type="text" value="${handle.get()}" class="input-widget" #box></div>`;
  const widget = <HTMLElement>boxTemplate.cloneNode(true);
  const { box } = boxTemplate.collect(widget);
  handle.add(() => box.value = value.formatter(handle.get()));
  const set = setter(handle, value);
  box.oninput = () => { if (value.parseValidator(box.value)) set(value.parser(box.value)) }
  box.onkeydown = arrowAction(handle, set);
  box.onwheel = wheelAction(handle, set);
  return widget;
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
  const printLabel = () => `${model.label} ${model.value.formatter(model.handle.get())}`;
  const buttonTemplate = h`<button class="btn btn-default btn-dropdown">${printLabel()}</button>`;
  const widget = numberBox(model.handle, model.value);
  const btn = <HTMLElement>buttonTemplate.cloneNode(true);
  const inst = tippy(btn, widgetPopup(widget));
  model.handle.add(() => btn.textContent = printLabel());
  btn.onwheel = wheelAction(model.handle, setter(model.handle, model.value));
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

export function rangeWidget(handle: Handle<number>, value: BasicValue<number>): HTMLElement {
  return sliderToolbarButton({ handle, label: "", value });
}

function listWidget(oracle: Oracle<string>, handle: Handle<string>): HTMLElement {
  return search('', null, oracle, handle);
}

export function rangeProp(label: string, handle: Handle<number>, value: BasicValue<number>): Property {
  return widgetProp(label, rangeWidget(handle, value));
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
