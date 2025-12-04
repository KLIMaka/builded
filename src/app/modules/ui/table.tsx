import Optional from 'optional-js';
import * as React from 'react';
import { DragEventHandler, ReactNode, useCallback, useContext, useEffect, useRef } from 'react';
import { AutoSizer, Column, SortDirectionType, Table, TableCellDataGetterParams, TableCellProps, TableHeaderProps, TableHeaderRowProps, TableRowProps } from 'react-virtualized';
import { Source, value, Value, ValuesContainer } from 'ts-utils/callbacks';
import { takeFirst } from 'ts-utils/collections';
import { clamp } from 'ts-utils/mathutils';
import { Consumer, Function, identity, nil, notNull, notUndefined } from 'ts-utils/types';
import { ActionDescriptorsContext, ActionsChannelContext, styles, useValue } from './commons';

export type HasTypedData<R, T> = { rowData: R, cellData?: T };
export type TypedTableCellProps<T, R> = Omit<TableCellProps, "cellData" | "rowData"> & HasTypedData<T, R>;
export type TypedTableCellRenderer<T, R> = Function<TypedTableCellProps<T, R>, ReactNode>;

export type VirtualTableColumn<R, T> = {
  renderer: TypedTableCellRenderer<R, T>,
  dataGetter: Function<TableCellDataGetterParams, T>
  id: string,
  label: string,
  width: number,
  grow?: number,
  shrink?: number
}

export function textCell<T, U = string>(f: (value: U) => string) {
  return ({ cellData }: TypedTableCellProps<T, U>) => {
    return <div>{f(notUndefined(cellData))}</div>
  }
}

export function textCellString<T>() {
  return textCell<T>(identity());
}

export function column<R, K extends keyof R>(id: K, label: string, renderer: TypedTableCellRenderer<R, R[K]>, width: number, grow = 0, shrink = 1): VirtualTableColumn<R, R[K]> {
  const dataGetter = (params: TableCellDataGetterParams) => params.rowData[params.dataKey];
  return { id: id as string, label, renderer, width, grow, shrink, dataGetter };
}

export function row<R>(id: string, label: string, renderer: TypedTableCellRenderer<R, R>, width: number, grow = 0, shrink = 1): VirtualTableColumn<R, R> {
  const dataGetter = (params: TableCellDataGetterParams) => params.rowData;
  return { id, label, renderer, width, grow, shrink, dataGetter };
}

export type SelectionController<R> = {
  isSelected(row: R): boolean;
  move(table: Table, d: number): void;
  selectAll(table: Table): void;
  select(table: Table, row: R, add: boolean): void
  selected(): R[];
  unselectAll(): void;
}

export function singleSelectionModel<R>(values: ValuesContainer, rows: Source<R[]>, def: R | undefined = undefined): Source<SelectionController<R>> {
  const selectedValue = values.value('selected', def);
  return values.transformedTuple('selection-model', [rows, selectedValue], ([rows, selectedRow]) => {
    const move = (table: Table, off: number) => {
      if (rows.length === 0) {
        selectedValue.set(undefined);
        return;
      }
      const currentItem = Optional.ofNullable(selectedRow);
      const currentItemIndex = currentItem.map(item => rows.indexOf(item)).orElse(-1);
      const next = clamp(currentItemIndex + off, 0, rows.length - 1);
      table.scrollToRow(next);
      selectedValue.set(rows[next]);
    };
    const isSelected = (r: R | undefined) => selectedRow === r;
    const selectAll = nil;
    const select = (table: Table, r: R, add: boolean) => selectedValue.set(r);
    const selected = () => Optional.ofNullable(selectedRow).map(s => [s]).orElse([]);
    const unselectAll = () => selectedValue.set(undefined);
    return { isSelected, move, selectAll, select, selected, unselectAll }
  });
}

export function setSelectionModel<R>(values: ValuesContainer, rows: Source<R[]>): Source<SelectionController<R>> {
  const selectedValue = values.value('selected', new Set<R>());
  return values.transformedTuple('selection-model', [rows, selectedValue], ([rows, selectedRows]) => {
    const move = (table: Table, off: number) => {
      if (rows.length === 0) {
        selectedValue.set(new Set());
        return;
      }
      const currentItem = takeFirst(selectedRows);
      const currentItemIndex = currentItem.map(item => rows.indexOf(item)).orElse(-1);
      const next = clamp(currentItemIndex + off, 0, rows.length - 1);
      table.scrollToRow(next);
      selectedValue.set(new Set([rows[next]]));
    };
    const isSelected = (r: R) => selectedRows.has(r);
    const selectAll = () => selectedValue.set(new Set(rows));
    const select = (table: Table, r: R, add: boolean) => {
      if (add) selectedValue.mod(rs => new Set([...rs, r]));
      else selectedValue.set(new Set([r]));
    }
    const selected = () => [...selectedRows];
    const unselectAll = () => selectedValue.set(new Set());
    return { isSelected, move, selectAll, select, selected, unselectAll }
  });
}

export function selectIdSelectionModel<R>(values: ValuesContainer, selectedValue: Value<number>, rows: Source<R[]>): Source<SelectionController<R>> {
  return values.transformedTuple('selection-model', [rows, selectedValue], ([rows, selectedId]) => {
    const move = (table: Table, off: number) => {
      if (rows.length === 0) {
        selectedValue.set(-1);
      } else {
        const next = clamp(selectedId + off, 0, rows.length - 1);
        table.scrollToRow(next);
        selectedValue.set(next);
      }
    };
    const isSelected = (r: R) => rows[selectedId] === r;
    const selectAll = nil;
    const select = (table: Table, r: R, add: boolean) => selectedValue.set(rows.indexOf(r))
    const selected = () => [rows[selectedId]];
    const unselectAll = () => selectedValue.set(-1);
    return { isSelected, move, selectAll, select, selected, unselectAll }
  })
}

export type VirtualTableProps<R> = {
  columns: VirtualTableColumn<R, any>[]
  rows: Source<R[]>,
  sort?: Value<Sort<R>>,
  selected: Source<SelectionController<R>>,
  rowHeight?: number,
  disableHeader?: boolean,
  onDrop?: DragEventHandler,
  onDubleClick?: Consumer<R>;
}

export type Sort<T> = { column: keyof T | undefined, direction: SortDirectionType | undefined };
const EMPTY_SORT: Sort<any> = { column: undefined, direction: undefined };
const EMPTY_SORT_VALUE = value('empy-sort', EMPTY_SORT);

function HeaderRowRenderer({ columns, style }: TableHeaderRowProps) {
  return (<div className='virtual-table-row-container' style={{ ...style }}>
    <div className={`virtual-table-header-row row-block baseline-aligned gap-5 `}>{columns}</div>
  </div>)
}

function HeaderRenderer(props: TableHeaderProps) {
  return (<div className='row-block gap-5 baseline-aligned'>
    {props.sortBy === props.dataKey ? <div className={`fa-solid  ${props.sortDirection === 'ASC' ? 'fa-angle-up' : 'fa-angle-down'}`} /> : <></>}
    {props.label}
  </div>)
}

function createDragDrop(onDrop?: DragEventHandler) {
  if (!onDrop) return {}
  else return {
    onDragEnter: (e: React.DragEvent) => { e.stopPropagation(); e.preventDefault() },
    onDragOver: (e: React.DragEvent) => { e.stopPropagation(); e.preventDefault() },
    onDrop: (e: React.DragEvent) => { e.stopPropagation(); e.preventDefault(); onDrop(e); }
  }
}

export function VirtualTable<R>(props: VirtualTableProps<R>) {
  const rows = useValue(props.rows);
  const sort = useValue(props.sort ?? EMPTY_SORT_VALUE);
  const selected = useValue(props.selected);
  const actionDescriptors = useContext(ActionDescriptorsContext);
  const actionsChannel = useContext(ActionsChannelContext);
  const rowHeight = props.rowHeight ?? 20;
  const tableRef = useRef<Table>(null);

  const getTable = () => notNull(tableRef.current);
  const createActions = useCallback(() => {
    const ctx = actionDescriptors.sub('table');
    const nextAction = ctx.bindSync('next', () => selected.move(getTable(), 1));
    const prevAction = ctx.bindSync('prev', () => selected.move(getTable(), -1));
    const nextPageAction = ctx.bindSync('next-page', () => selected.move(getTable(), 10));
    const prevPageAction = ctx.bindSync('prev-page', () => selected.move(getTable(), -10));
    const selectAllAction = ctx.bindSync('select-all', () => selected.selectAll(getTable()));
    return [nextAction, prevAction, nextPageAction, prevPageAction, selectAllAction];
  }, [actionDescriptors, selected])

  useEffect(() => {
    return actionsChannel.collector().add(...createActions());
  }, [actionsChannel, createActions]);

  const RowRenderer = useCallback(({ style, index, columns, rowData }: TableRowProps) => {
    return <div
      onClick={e => selected.select(getTable(), rowData, e.ctrlKey)}
      onDoubleClick={e => (props.onDubleClick ?? nil)(rowData)}
      key={index}
      className='virtual-table-row-container'
      style={{ ...style, height: rowHeight - 1, paddingRight: style.paddingRight + 2 }}>
      <div className={`virtual-table-row row-block baseline-aligned gap-5 ${styles({ selected: selected.isSelected(rowData), even: index % 2 === 0 })}`}>
        {columns}
      </div>
    </div >;
  }, [props.onDubleClick, rowHeight, selected])
  const sortF = useCallback(({ sortBy, sortDirection }: { sortBy: string, sortDirection: SortDirectionType }) => {
    props.sort?.set({ column: sortBy as keyof R, direction: sortDirection })
  }, [props.sort]);
  const dragDrop = createDragDrop(props.onDrop);


  return (
    <div className='virtual-table-container flex-fill' {...dragDrop}>
      <AutoSizer >
        {({ height, width }) => (
          <Table
            gridClassName='virtual-table'
            ref={tableRef}
            disableHeader={props.disableHeader}
            width={width - 2}
            height={height - 2}
            rowHeight={rowHeight}
            headerHeight={rowHeight - 1}
            rowCount={rows.length}
            rowGetter={({ index }) => rows[index]}
            headerRowRenderer={HeaderRowRenderer}
            rowRenderer={RowRenderer}
            sort={sortF}
            sortBy={sort.column as string}
            sortDirection={sort.direction}
          >
            {props.columns.map(c => <Column
              key={c.id}
              dataKey={c.id}
              label={c.label}
              width={c.width}
              flexGrow={c.grow}
              flexShrink={c.shrink}
              cellRenderer={c.renderer}
              cellDataGetter={c.dataGetter}
              headerRenderer={HeaderRenderer}
              headerClassName='virtual-table-header-column'
            />
            )}
          </Table>
        )}
      </AutoSizer>
    </div>
  )
}