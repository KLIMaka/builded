import { useValuesContainer, Row, Icon, Column } from "@ui/commons";
import { selectIdSelectionModel, TypedTableCellProps, VirtualTable, row } from "@ui/table";
import { Values } from "app/apis/values";
import React from "react";
import { Source, ValuesContainer } from "ts-utils/callbacks";
import { getOrDefault } from "ts-utils/collections";
import { pair, notUndefined } from "ts-utils/types";

type ValueRecord = {
  type: 'value',
  value: Source<any>,
  depth: number
}

type ValueContainerRecord = {
  type: 'container',
  container: ValuesContainer,
  open: boolean,
  depth: number
}

type ValuesListRecord = ValueRecord | ValueContainerRecord;
type Dependency = { type: 'in' | 'out', depth: number };
type UtilDependency = { type: 'src' | 'none' };
const NULL_DEP: UtilDependency = { type: 'none' };
const SRC_DEP: UtilDependency = { type: 'src' };
type DependencyType = Dependency | UtilDependency;
export type ValuesListRecordDeps = ValuesListRecord & { deps: DependencyType }

export function ValuesView(props: { values: Values }) {
  const values = useValuesContainer('values-view');
  const openContainers = values.value('open-containers', new Map<ValuesContainer, boolean>());
  const allContainers = values.transformedTuple('all-containers', [props.values.root, openContainers], ([root, open]) => {
    function lookup(depth: number, container: ValuesContainer): ValuesListRecord[] {
      if (getOrDefault(open, container, false)) {
        const first: ValueContainerRecord = { type: 'container', container, open: true, depth }
        const values = container.graph.nodes.keys().filter(v => (v as any)?.name !== undefined).map<ValueRecord>(v => ({ type: 'value', depth: depth + 1, value: v as any as Source<any> }));
        return [first, ...container.children.values().flatMap(c => lookup(depth + 1, c)), ...values];
      } else return [{ type: 'container', container, open: false, depth }];
    }
    return root
      .filter(c => c.parent === undefined)
      .flatMap(c => lookup(0, c));
  });
  const selectedId = values.value('selected-id', -1);
  const allDeps = values.transformedTuple('all-deps', [allContainers, selectedId], ([all, selected]): ValuesListRecordDeps[] => {
    const selectedRow = all[selected];
    return selectedRow === undefined || selectedRow.type === 'container'
      ? all.map(r => ({ ...r, deps: NULL_DEP }))
      : all.map(r => {
        if (r === selectedRow) return { ...r, deps: SRC_DEP }
        else if (r.type === 'value') {
          return selectedRow.value.depends(r.value)
            .map<ValuesListRecordDeps>(depth => ({ ...r, deps: { type: 'in', depth } }))
            .or(() => r.value.depends(selectedRow.value).map<ValuesListRecordDeps>(depth => ({ ...r, deps: { type: 'out', depth } })))
            .orElse({ ...r, deps: NULL_DEP });
        } else if (r.type === 'container' && !r.open) {
          return r.container.depends(selectedRow.value)
            .map<ValuesListRecordDeps>(depth => ({ ...r, deps: { type: 'out', depth } }))
            .orElse({ ...r, deps: NULL_DEP })
        }
        return { ...r, deps: NULL_DEP };
      })
  });

  const depRange = values.transformed('dep-range', allDeps, all => pair(all.findIndex(r => r.deps.type !== 'none'), all.findLastIndex(r => r.deps.type !== 'none')));
  const selectionModel = selectIdSelectionModel(values, selectedId, allDeps);
  const rowRenderer = ({ cellData, rowIndex }: TypedTableCellProps<ValuesListRecordDeps, ValuesListRecordDeps>) => {
    const [first, last] = depRange.get();
    const data = notUndefined(cellData);
    const padd = data.depth * 10;
    const label = rowIndex >= first && rowIndex <= last
      ? data.deps.type === 'in' ? `${data.deps.depth}>`
        : data.deps.type === 'out' ? `${data.deps.depth}<`
          : data.deps.type === 'src' ? '=='
            : '│'
      : '';
    const icon = data.type === 'container' ? data.open ? 'folder-open' : 'folder' : 'tag';
    const fullName = data.type === 'container' ? data.container.name : data.value.name ?? '';
    const name = data.type === 'container' ? fullName.substring(0, fullName.length - 10) : fullName;
    const id = data.type === 'container' ? fullName.substring(fullName.length - 10) : '';
    return <Row className="baseline-aligned gap-10">
      <div style={{ width: 16, paddingRight: padd, fontFamily: 'monospace' }}>{label}</div>
      <Icon icon={icon} />
      <div>{name}</div>
      <div style={{ color: 'var(--font-color-muted)' }}>{id}</div>
    </Row>
  }
  const openAction = (rec: ValuesListRecord) => { if (rec.type === 'container') openContainers.modImmer(m => m.set(rec.container, !(m.get(rec.container) ?? false))) }


  return <Column className="form-panel flex-fill padded-5">
    <Row className="flex-auto"></Row>
    <VirtualTable
      rows={allDeps}
      columns={[
        row('row', 'Name', rowRenderer, 0, 1, 1)
      ]}
      selected={selectionModel}
      onDubleClick={openAction}
    />
  </Column>
}