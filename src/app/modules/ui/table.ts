import { clamp } from "@utils/mathutils";
import { Consumer, nil } from "@utils/types";
import { AutoScroller } from "@utils/ui/ui";
import { Action, ActionDescriptors } from "app/apis/actions";
import { Disconnector, HandleProvider } from "app/apis/app1";
import { Block, ElemMod, TableColumn, TableModel, Ui, clazz, style } from "app/apis/ui";

type RowRecord<R> = { value: R, block: Block };
export class TableModelImpl<R> implements TableModel<R> {
  private root: Block;
  private table: Block;
  private tableRows: Block;
  private header: Block;
  private rowCursor = -1;
  private rowAction: Consumer<R> = nil();
  private rowsIndex = new Map<HTMLElement, number>();
  private rowsList: RowRecord<R>[] = [];
  private autoScroller: AutoScroller;
  private tableActions: Action[] = [];
  private selectionHandlers = new HandleProvider<Consumer<R>>();

  constructor(
    private ui: Ui,
    private columns: TableColumn<R, any>[]
  ) {
    this.tableActions = this.registerActions(ui.actionDescriptors().sub('table'));
    this.createTable();
    this.autoScroller = new AutoScroller(this.tableRows.cast());
  }

  addSelectionHandler(handler: Consumer<R>): Disconnector {
    return this.selectionHandlers.add(handler);
  }

  registerActions(ctx: ActionDescriptors) {
    return [
      ctx.bind('next', async () => this.selectRow(this.rowCursor + 1)),
      ctx.bind('prev', async () => this.selectRow(this.rowCursor - 1)),
      ctx.bind('next-page', async () => this.selectRow(this.rowCursor + 10)),
      ctx.bind('prev-page', async () => this.selectRow(this.rowCursor - 10)),
      ctx.bind('select', async () => this.action())
    ]
  }

  actions(): Iterable<Action> {
    return this.tableActions;
  }

  setRowAction(action: Consumer<R>) {
    this.rowAction = action;
  }

  private rowGridColumn(): ElemMod { return e => e.style.gridColumn = `1 / ${this.columns.length + 1}` }

  private createRow() {
    return this.ui.block('table-row', 'baseline-aligned').mod(this.rowGridColumn());
  }

  private createTable() {
    this.root = this.ui.block('table-container');
    const columnsTemplate = this.columns.map(c => c.size).join(' ');
    this.table = this.ui.block('table').mod(style.custom(s => s.gridTemplateColumns = columnsTemplate));
    this.root.append(this.table);
    this.header = this.createRow().mod(clazz.add('table-header'));
    this.columns.map(c => this.ui.block().text(c.title)).forEach(b => this.header.append(b));
    this.table.append(this.header);
    this.tableRows = this.ui.block('table-rows').mod(this.rowGridColumn());
    this.table.append(this.tableRows);
  }

  addRow(row: R) {
    const nrow = this.createRow();
    nrow.event('click', _ => this.selectRow(this.rowsIndex.get(nrow.cast())));
    Promise.all(this.columns.map(async c => c.renderer(this.ui, await c.selector(row)))).then(cells => cells.forEach(c => nrow.append(c)));
    this.tableRows.append(nrow);
    const ptr = this.rowsList.length;
    this.rowsList.push({ value: row, block: nrow })
    this.rowsIndex.set(nrow.cast(), ptr);
    return ptr;
  }

  clear() {
    this.tableRows.replace();
    this.rowCursor = -1;
    this.rowsIndex.clear();
    this.rowsList = [];
  }

  asWidget(): Block {
    return this.root;
  }

  selectRow(rowIdx: number) {
    if (this.rowsList.length == 0) return;
    if (rowIdx == undefined) return;
    rowIdx = clamp(rowIdx, 0, this.rowsList.length - 1);
    if (this.rowCursor == rowIdx) return;
    if (this.rowCursor != -1) this.rowsList[this.rowCursor].block.mod(clazz.remove('selected'));
    this.rowCursor = rowIdx;
    const row = this.rowsList[rowIdx];
    row.block.mod(clazz.add('selected'));
    this.autoScroller.show(row.block.cast());
    this.selectionHandlers.get().forEach(h => h(row.value));
  }

  getSelectedRowData(): R {
    if (this.rowCursor == -1) return null;
    return this.rowsList[this.rowCursor].value;
  }

  private action() {
    if (this.rowCursor == -1) return;
    this.rowAction(this.rowsList[this.rowCursor].value);
  }
}