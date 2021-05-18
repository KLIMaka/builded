import tippy from "tippy.js";
import { MenuBuilder } from "../../app/apis/ui";
import { iter } from "../iter";
import { div, Element, replaceContent, span, Table, tag } from "./ui";
import h from "stage0";
import { map } from "../collections";
import { PreFrame } from "../../app/edit/messages";

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
  tippy(btn, {
    content: widget,
    allowHTML: true,
    placement: 'bottom-start',
    trigger: 'click',
    interactive: true,
    arrow: false,
    offset: [0, 0],
    duration: 100,
    appendTo: document.body
  });
  return btn;
}

interface SuggestionModel {
  readonly widget: HTMLElement,
  shift(d: number): void;
  select(): void;
}

const suggestTemplate = h`
<button class="btn btn-default btn-mini pull-right" #button>
  <span class="icon icon-search"></span>
  <input type="text" class="toolbar-control" #input>
</button>
`;

export type Oracle<T> = (s: string) => Iterable<T>;

export function search(hint: string, oracle: Oracle<string>): HTMLElement {
  const root = suggestTemplate.cloneNode(true);
  const { button, input } = suggestTemplate.collect(root);
  const suggestContainer = div('suggest').elem();
  let suggestModel: SuggestionModel = null;
  const suggestions = menu(input, suggestContainer);
  const update = (items: Iterable<string>) => {
    suggestModel = sugggestionsMenu(map(items, (i: string) => <[string, () => void]>[i, () => { input.value = i; oracle(i); suggestions.hide() }]));
    replaceContent(suggestContainer, suggestModel.widget);
    suggestions.show();
  }
  input.oninput = () => update(oracle(input.value));
  input.placeholder = hint;
  input.addEventListener('keydown', e => {
    if (e.key == 'ArrowDown') suggestModel.shift(1)
    else if (e.key == 'ArrowUp') suggestModel.shift(-1)
    else if (e.key == 'Enter') suggestModel.select()
    else if (e.key == 'Escape') suggestions.hide()
  });
  button.onclick = () => { input.value = ''; update(oracle('')) };
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
  select(0);
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
  min: number,
  max: number,
  def: number,
  setValue(value: number): void,
}

export function sliderToolbarButton(model: SliderModel) {
  const widgetTemplate = h`<div class="popup-widget">
  <input type="range" min="${model.min}" max="${model.max}" value="${model.def}" style="vertical-align: middle; margin-right:10px" #range>
  <input type="number" min="${model.min}" max="${model.max}" value="${model.def}" step="1" class="input-widget" #box></div>`;
  const buttonTemplate = h`<button class="btn btn-default btn-dropdown">${model.label} ${model.def}</button>`;
  const widget = <HTMLElement>widgetTemplate.cloneNode(true);
  const { range, box } = widgetTemplate.collect(widget);
  const btn = <HTMLElement>buttonTemplate.cloneNode(true);
  tippy(btn, {
    content: widget, maxWidth: 500, allowHTML: true, placement: 'bottom-start', trigger: 'click', interactive: true, arrow: false, offset: [0, 0], duration: 100, appendTo: document.body
  });
  const setValue = (value: number) => {
    range.value = value;
    box.value = value;
    btn.textContent = `${model.label} ${value}`;
    model.setValue(value);
  }
  range.oninput = () => setValue(range.value);
  box.oninput = () => setValue(box.value);
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
  widget: () => HTMLElement
}

export function textProp(label: string, change: (value: string) => void, value: string): Property {
  const template = h`<input type="text" value="${value}" class="input-widget" style="max-width:100px">`;
  const widget = () => {
    const root = <HTMLInputElement>template.cloneNode(true);
    root.oninput = () => change(root.value);
    return root;
  }
  return { label, widget }
}

export function rangeProp(label: string, min: number, max: number, change: (value: number) => void, value: number): Property {
  const template = h`<input type="range" min="${min}" max="${max} value"${value}" style="vertical-align: middle;">`;
  const widget = () => {
    const root = <HTMLInputElement>template.cloneNode(true);
    root.oninput = () => change(Number.parseInt(root.value));
    return root;
  }
  return { label, widget }
}

const propertiesTemplate = h`<div style="padding:10px 5px"></div>`;
const propertyTemplate = h`<div><span style="padding:0px 5px; width:100px">#label</span><span #widget></span></div>`;
export function properties(properties: Property[]): HTMLElement {
  const props = <HTMLElement>propertiesTemplate.cloneNode(true);
  for (const p of properties) {
    const prop = propertyTemplate.cloneNode(true);
    const { label, widget } = propertyTemplate.collect(prop);
    label.nodeValue = p.label;
    widget.appendChild(p.widget());
    props.appendChild(prop);
  }
  return props;
}

