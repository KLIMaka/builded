import { iter } from "../iter";
import { Element, Table, span } from "./ui";

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