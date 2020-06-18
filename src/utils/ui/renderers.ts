import tippy from "tippy.js";
import { MenuBuilder } from "../../app/apis/ui";
import { iter } from "../iter";
import { div, Element, span, Table, tag } from "./ui";

export type ColumnRenderer<T> = (value: T) => Element;

export interface GridModel {
  rows(): Promise<Iterable<any[]>>;
  columns(): Iterable<ColumnRenderer<any>>;
  onClick(row: any[], rowElement: Element): void;
}

export function IconTextRenderer(value: [string, string]): Element {
  const text = span().className('icon-text').text(value[0]);
  if (value[1] != null)
    text.append(span().className('icon pull-left ' + value[1]));
  return text;
}

export async function renderGrid(grid: GridModel): Promise<Element> {
  const table = new Table();
  table.className("table-striped");
  iter(await grid.rows()).forEach(f => {
    const columns = [...iter(grid.columns()).enumerate().map(([r, i]) => r(f[i]))];
    const row = table.row(columns);
    row.click(() => grid.onClick(f, row));
  });
  return table;
}

export function sugggestionsMenu(items: Iterable<[string, () => void]>): SuggestionModel {
  const menu = div('menu menu-default');
  let selected = -1;
  const options: [Element, () => void][] = [];
  for (const [label, click] of items) {
    const item = div('menu-item').text(label).click(() => click());
    options.push([item, click]);
    menu.append(item);
  }
  if (options.length != 0) {
    selected = 0;
    options[selected][0].elem().classList.add('selected');
  }
  return {
    widget: menu.elem(),
    shift(d: number) {
      if (options.length == 0) return;
      const newSelected = Math.min(Math.max(0, selected + d), options.length - 1);
      if (newSelected != selected) {
        options[selected][0].elem().classList.remove('selected');
        options[newSelected][0].elem().classList.add('selected');
        selected = newSelected;
      }
    },

    select() {
      if (options.length == 0) return;
      else options[selected][1]();
    }
  }
}

export function renderMenu(items: Iterable<[string, () => void]>) {
  const menu = div('menu menu-default');
  for (const [label, click] of items)
    menu.append(div('menu-item').text(label).click(() => click()));
  return menu;
}

export function menuButton(icon: string, menu: MenuBuilder): HTMLElement {
  const btn = tag('button').className('btn btn-default btn-dropdown').append(span().className('icon ' + icon));
  menu.build(btn.elem());
  return btn.elem();
}

export interface SerachBar {
  readonly widget: HTMLElement;
  setValue(s: String): void;
  updateSuggestions(model: SuggestionModel): void;
}

export interface SuggestionModel {
  readonly widget: HTMLElement,
  shift(d: number): void;
  select(): void;
}

export function search(hint: string, change: (s: string) => void): SerachBar {
  const suggestContainer = div('suggest');
  let suggestModel: SuggestionModel = null;
  const textBox = tag('input').className('toolbar-control')
    .attr('type', 'text')
    .attr('placeholder', hint)
    .change(s => change(s));
  const input = <HTMLInputElement>textBox.elem();
  input.addEventListener('keydown', e => {
    if (e.key == 'ArrowDown') suggestModel.shift(1)
    else if (e.key == 'ArrowUp') suggestModel.shift(-1)
    else if (e.key == 'Enter') suggestModel.select()
  });
  const searchBar =
    tag('button').className('btn btn-default btn-mini pull-right')
      .append(span().className('icon icon-search'))
      .append(textBox)
      .click(() => { (<HTMLInputElement>textBox.elem()).value = ''; change('') });

  const inst = tippy(textBox.elem(), {
    allowHTML: true,
    placement: 'bottom-start',
    interactive: true,
    content: suggestContainer.elem(),
    trigger: 'focus',
    arrow: false,
    offset: [0, 0],
    appendTo: document.body
  });

  return {
    widget: searchBar.elem(),
    setValue(s: string) { input.value = s; inst.hide() },
    updateSuggestions(model: SuggestionModel) {
      suggestModel = model
      const sugg = suggestContainer.elem();
      if (sugg.firstChild != null) sugg.removeChild(sugg.firstChild);
      sugg.appendChild(model.widget);
      inst.show();
    },
  }
}