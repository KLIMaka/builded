import { FileInfo } from "app/apis/fs";
import { Column, Row, Spacer, useValuesContainer } from "app/modules/ui/commons";
import { Sort, VirtualTable, VirtualTableColumn, column, singleSelectionModel } from "app/modules/ui/table";
import React from "react";
import { sum } from "ts-utils/mathutils";
import { Editor, EngineInfo } from "../engine-context";
import { FileNameRenderer, FileSizeRenderer, FileSourceRenderer, FilesSummary, sortFunction } from "./common";
import { SearchBox } from "app/modules/ui/search-box";

const fileColumns: VirtualTableColumn<FileInfo, any>[] = [
  column("name", "Name", FileNameRenderer, 0, 1, 1),
  column("src", "Source", FileSourceRenderer, 120),
  column("size", "Size", FileSizeRenderer, 60),
];

export function FilesInfoView({ info, editor }: { info: EngineInfo, editor: Editor }) {
  const values = useValuesContainer(`files`);
  const sort = values.value<Sort<FileInfo>>('sort', { column: 'name', direction: "ASC" });
  const query = values.value('query', '');
  const filtered = values.transformedTuple('filtered-files', [info.files, query], ([files, query]) => files.filter(f => f.name.toLowerCase().includes(query.toLowerCase())));
  const sortedFiles = values.transformedTuple('sorted-files', [filtered, sort], ([files, sort]) => {
    const sortColumn = sort.column;
    if (sortColumn === undefined) return files;
    const [dirG, dirL] = sort.direction === 'ASC' ? [-1, 1] : [1, -1];
    return files.toSorted(sortFunction(sortColumn, dirG, dirL));
  });
  const filesCount = values.transformed('files-count', info.files, files => files.length);
  const filesSize = values.transformed('files-size', info.files, files => files.map(m => m.size).reduce(sum, 0));

  return <Column className='form-panel gap-5'>
    <Row className="flex-auto">
      <Spacer />
      <SearchBox value={query} channelName='search' />
    </Row>
    <Row className="flex-fill">
      <VirtualTable
        columns={fileColumns}
        rows={sortedFiles}
        selected={singleSelectionModel(values, sortedFiles)}
        sort={sort}
        onDubleClick={row => editor.openFile(info.ctx, info.rendererProvider, row.name)}
      />
    </Row>
    <FilesSummary filesCount={filesCount} filesSize={filesSize} />
  </Column>
}