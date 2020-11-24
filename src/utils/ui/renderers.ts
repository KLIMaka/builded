import tippy from "tippy.js";
import { MenuBuilder } from "../../app/apis/ui";
import { iter } from "../iter";
import { div, Element, replaceContent, span, Table, tag } from "./ui";
import h from "stage0";

export type ColumnRenderer<T> = (value: T) => Element;

export interface GridModel {
  rows(): Promise<Iterable<any[]>>;
  columns(): Iterable<ColumnRenderer<any>>;
  onClick(row: any[], rowElement: Element): void;
}

export type IconText = { text: string, icon: string, style: string };

export function IconTextRenderer(value: IconText): Element {
  const text = span().className('icon-text').text(value.text);
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

const suggestTemplate = h`
<button class="btn btn-default btn-mini pull-right" #button>
  <span class="icon icon-search"></span>
  <input type="text" class="toolbar-control" #input>
</button>
`;

export function search(hint: string, change: (s: string) => void): SerachBar {
  const root = suggestTemplate.cloneNode(true);
  const { button, input } = suggestTemplate.collect(root);
  const suggestContainer = div('suggest').elem();
  let suggestModel: SuggestionModel = null;
  input.oninput = () => change(input.value);
  input.placeholder = hint;
  input.addEventListener('keydown', e => {
    if (e.key == 'ArrowDown') suggestModel.shift(1)
    else if (e.key == 'ArrowUp') suggestModel.shift(-1)
    else if (e.key == 'Enter') suggestModel.select()
  });
  button.onclick = () => { input.value = ''; change('') };

  const inst = tippy(<HTMLElement>input, {
    allowHTML: true,
    placement: 'bottom-start',
    interactive: true,
    content: suggestContainer,
    trigger: 'focus',
    arrow: false,
    offset: [0, 0],
    appendTo: document.body
  });

  return {
    widget: button,
    setValue(s: string) { input.value = s; inst.hide() },
    updateSuggestions(model: SuggestionModel) {
      suggestModel = model
      replaceContent(suggestContainer, model.widget);
      inst.show();
    },
  }
}