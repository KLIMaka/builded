import { Source, Value } from '@utils/callbacks';
import { takeFirst } from '@utils/collections';
import { clamp } from '@utils/mathutils';
import { Function } from '@utils/types';
import * as React from 'react';
import { DragEventHandler, ReactNode, useCallback, useContext, useEffect, useRef } from 'react';
import { AutoSizer, Column, SortDirectionType, Table, TableCellProps, TableHeaderProps, TableRowProps } from 'react-virtualized';
import { ActionDescriptorsContext, ActionsChannelContext, styles, useValue } from './commons';

export type HasTypedData<R, T> = { rowData: R, cellData: T };
export type TypedTableCellProps<T, R> = Omit<TableCellProps, "cellData" | "rowData"> & HasTypedData<T, R>;
export type TypedTableCellRenderer<T, R> = Function<TypedTableCellProps<T, R>, ReactNode>;

export type VirtualTableColumn<R, K extends keyof R> = {
  renderer: TypedTableCellRenderer<R, R[K]>,
  id: K,
  label: string,
  width: number,
  grow?: number,
  shrink?: number
}

export function column<R, K extends keyof R>(id: K, label: string, renderer: TypedTableCellRenderer<R, R[K]>, width: number, grow = 0, shrink = 1) {
  return { id, label, renderer, width, grow, shrink } as VirtualTableColumn<R, K>;
}

export type VirtualTableProps<R> = {
  columns: VirtualTableColumn<R, any>[]
  rows: Source<R[]>,
  sort: Value<Sort>,
  selected: Value<Set<R>>,
  rowHeight?: number,
  disableHeader?: boolean,
  onDrop?: DragEventHandler,
}

export type Sort = { column: string, direction: SortDirectionType };

function HeaderRowRenderer({ columns, style }) {
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
  const sort = useValue(props.sort);
  const selected = useValue(props.selected);
  const actionDescriptors = useContext(ActionDescriptorsContext);
  const actionsChannel = useContext(ActionsChannelContext);
  const rowHeight = props.rowHeight ?? 18;
  const tableRef = useRef<Table>();

  const moveCursor = useCallback((off: number) => {
    if (rows.length === 0) {
      props.selected.set(new Set());
      return;
    }
    const currentItem = takeFirst(selected).orElse(null);
    const currentItemIndex = rows.indexOf(currentItem);
    const next = clamp(currentItemIndex + off, 0, rows.length - 1);
    tableRef.current?.scrollToRow(next);
    props.selected.set(new Set([rows[next]]));
  }, [props.selected, rows, selected]);

  const createActions = useCallback(() => {
    const ctx = actionDescriptors.sub('table');
    const nextAction = ctx.bindSync('next', () => moveCursor(1));
    const prevAction = ctx.bindSync('prev', () => moveCursor(-1));
    const nextPageAction = ctx.bindSync('next-page', () => moveCursor(10));
    const prevPageAction = ctx.bindSync('prev-page', () => moveCursor(-10));
    const selectAllAction = ctx.bindSync('select-all', () => props.selected.set(new Set([...rows])));
    return [nextAction, prevAction, nextPageAction, prevPageAction, selectAllAction];
  }, [actionDescriptors, moveCursor, props.selected, rows])

  useEffect(() => {
    return actionsChannel.collector().add(...createActions());
  }, [actionsChannel, createActions]);

  function RowRenderer({ style, index, columns, rowData }: TableRowProps) {
    return <div onClick={e => props.selected.mod(s => e.ctrlKey ? new Set([...s, rowData]) : new Set([rowData]))}
      key={index}
      className={`virtual-table-row-container`}
      style={{ ...style, height: rowHeight - 1, paddingRight: style.paddingRight + 2 }}>
      <div className={`virtual-table-row row-block baseline-aligned gap-5 ${styles({ selected: selected.has(rowData), even: index % 2 === 0 })}`}>
        {columns}
      </div>
    </div >;
  }
  function sortF({ sortBy, sortDirection }: { sortBy: string, sortDirection: SortDirectionType }) { props.sort.set({ column: sortBy, direction: sortDirection }) }
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
            sortBy={sort.column}
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