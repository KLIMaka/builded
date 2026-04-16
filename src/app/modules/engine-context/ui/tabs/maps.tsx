import { Column, Icon, NonwrapLabel, Row, Spacer, useValue, useValuesContainer } from "@ui/commons";
import { column, singleSelectionModel, Sort, TypedTableCellProps, VirtualTable, VirtualTableColumn } from "@ui/table";
import { FileInfo, FileSource } from "app/apis/fs";
import { fsIcon } from "app/modules/fs/ui/fs-ui-utils";
import React from "react";
import { match } from "ts-pattern";
import { Source } from "ts-utils/callbacks";
import { sum } from "ts-utils/mathutils";
import { size } from "ts-utils/size";
import { BiFn } from "ts-utils/types";
import { Editor, EngineInfo } from "../engine-context";


function FileNameRenderer({ cellData }: TypedTableCellProps<FileInfo, string>) {
  return (<div className='row-block baseline-aligned gap-5'>
    <Icon icon='file' />
    <NonwrapLabel label={cellData} />
  </div>)
}

function FileSizeRenderer({ cellData }: TypedTableCellProps<FileInfo, number>) {
  return <div>{size(cellData ?? 0)}</div>
}

function FileSourceRenderer({ cellData }: TypedTableCellProps<FileInfo, FileSource>) {
  return <Row className="baseline-aligned gap-5">
    <Icon icon={fsIcon(cellData?.type)} className='fa-fixwidth' />
    <NonwrapLabel label={cellData?.name} />
  </Row>
}

const mapsColumns: VirtualTableColumn<FileInfo, any>[] = [
  column("name", "Name", FileNameRenderer, 0, 1, 1),
  column("src", "Source", FileSourceRenderer, 120),
  column("size", "Size", FileSizeRenderer, 60),
];

function MapsSummary(props: { mapsCount: Source<number>, mapsSize: Source<number> }) {
  const count = useValue(props.mapsCount);
  const mapsSize = useValue(props.mapsSize);

  return <Row className="flex-auto">
    <Spacer />
    Total: {count} Size: {size(mapsSize)}
  </Row>
}

function sortFunction(field: keyof FileInfo, dirG: number, dirL: number): BiFn<FileInfo, FileInfo, number> {
  return match(field)
    .returnType<BiFn<FileInfo, FileInfo, number>>()
    .with('lastModified', 'size', f => (l, r) => l[f] < r[f] ? dirG : dirL)
    .with('name', f => (l, r) => l[f].toLowerCase() < r[f].toLowerCase() ? dirG : dirL)
    .with('src', f => (l, r) => l[f].name.toLowerCase() < r[f].name.toLowerCase() ? dirG : dirL)
    .exhaustive()
}

export function MapsInfoView({ info, editor }: { info: EngineInfo, editor: Editor }) {
  const values = useValuesContainer(`maps`);
  const sort = values.value<Sort<FileInfo>>('sort', { column: 'name', direction: "ASC" });
  const sortedMaps = values.transformedTuple('sorted-maps', [info.mapFiles, sort], ([maps, sort]) => {
    const sortColumn = sort.column;
    if (sortColumn === undefined) return maps;
    const [dirG, dirL] = sort.direction === 'ASC' ? [-1, 1] : [1, -1];
    return maps.toSorted(sortFunction(sortColumn, dirG, dirL));
  });
  const mapsCount = values.transformed('maps-count', info.mapFiles, maps => maps.length);
  const mapsSize = values.transformed('maps-size', info.mapFiles, maps => maps.map(m => m.size).reduce(sum))

  return <Column className='form-panel gap-5'>
    <Row className="flex-auto">
      <Spacer />
    </Row>
    <Row className="flex-fill">
      <VirtualTable
        columns={mapsColumns}
        rows={sortedMaps}
        selected={singleSelectionModel(values, sortedMaps)}
        sort={sort}
        onDubleClick={row => editor.openMap(info.ctx, info.textures, info.rendererProvider, row.name)}
      />
    </Row>
    <MapsSummary mapsCount={mapsCount} mapsSize={mapsSize} />
  </Column>
}