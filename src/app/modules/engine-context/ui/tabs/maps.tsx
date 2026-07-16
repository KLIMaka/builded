import { Column, Row, Spacer, useValuesContainer } from "@ui/commons";
import { column, singleSelectionModel, Sort, VirtualTable, VirtualTableColumn } from "@ui/table";
import { FileInfo } from "app/apis/fs";
import React from "react";
import { sum } from "ts-utils/mathutils";
import { Editor, EngineInfo } from "../engine-context";
import { FileNameRenderer, FileSizeRenderer, FileSourceRenderer, FilesSummary, sortFunction } from "./common";
import { iter } from "ts-utils/iter";

const mapsColumns: VirtualTableColumn<FileInfo, any>[] = [
  column("name", "Name", FileNameRenderer, 0, 1, 1),
  column("src", "Source", FileSourceRenderer, 120),
  column("size", "Size", FileSizeRenderer, 60),
];

export function MapsInfoView({ info, editor }: { info: EngineInfo, editor: Editor }) {
  const values = useValuesContainer(`maps`);
  const mapFiles = values.transformed(`maps`, info.files, files => iter(files).filter(f => f.name.toLowerCase().endsWith('.map')).collect());
  const sort = values.value<Sort<FileInfo>>('sort', { column: 'name', direction: "ASC" });
  const sortedMaps = values.transformedTuple('sorted-maps', [mapFiles, sort], ([maps, sort]) => {
    const sortColumn = sort.column;
    if (sortColumn === undefined) return maps;
    const [dirG, dirL] = sort.direction === 'ASC' ? [-1, 1] : [1, -1];
    return maps.toSorted(sortFunction(sortColumn, dirG, dirL));
  });
  const mapsCount = values.transformed('maps-count', mapFiles, maps => maps.length);
  const mapsSize = values.transformed('maps-size', mapFiles, maps => maps.map(m => m.size).reduce(sum, 0))

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
    <FilesSummary filesCount={mapsCount} filesSize={mapsSize} />
  </Column>
}