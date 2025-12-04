import { ActionButton, ActionDescriptorsContext, Column, FieldValue, NonwrapLabel, Row, useValuesContainer } from "@ui/commons";
import { column, singleSelectionModel, TypedTableCellProps, VirtualTable, VirtualTableColumn } from "@ui/table";
import React, { useContext } from "react";
import { sum } from "ts-utils/mathutils";
import { size } from "ts-utils/size";
import { notUndefined } from "ts-utils/types";
import { Editor, EngineInfo } from "../engine-context";


type ArtFileInfo = Readonly<{
  name: string,
  start: number,
  end: number,
  empty: number,
  size: number,
}>;

function ArtName({ cellData }: TypedTableCellProps<ArtFileInfo, string>) {
  return <NonwrapLabel label={cellData} />
}

function ArtField({ cellData }: TypedTableCellProps<ArtFileInfo, number>) {
  return <NonwrapLabel label={cellData} />
}

function ArtSize({ cellData }: TypedTableCellProps<ArtFileInfo, number>) {
  return <NonwrapLabel label={size(notUndefined(cellData))} />
}

const COLUMNS: VirtualTableColumn<ArtFileInfo, any>[] = [
  column('name', 'Name', ArtName, 0, 1, 1),
  column('start', 'Offset', ArtField, 60),
  column('empty', 'Empty', ArtField, 60),
  column('size', 'Size', ArtSize, 60),
]

export function ArtsInfoView({ info, editor }: { info: EngineInfo, editor: Editor }) {
  const values = useValuesContainer(`arts`);
  const artFilesCount = values.transformed('artFilesCount', info.artFiles, afs => afs.length + '');
  const totalSize = values.transformed('total-size', info.artFiles, files => size(files.map(f => f.art.fileSize).reduce(sum, 0)))
  const arts = values.transformedTuple('arts', [info.arts, info.validArts], ([total, valid]) => `${total} / ${valid}`)
  const files = values.transformed('art-files', info.artFiles, files => files.map(f => ({
    name: f.name,
    start: f.art.header.start,
    end: f.art.header.end,
    size: f.art.fileSize,
    empty: f.art.arts
      .filter(a => a.h === 0 || a.w === 0)
      .length
  })));
  const actionDescriptors = useContext(ActionDescriptorsContext);
  const ctx = actionDescriptors.sub('arts');
  const artEditorAction = ctx.bind('art-editor', () => editor.openArtEditor(info.ctx));

  return <Column className='form-panel'>
    <Column className='form-panel-rows-container'>
      <FieldValue label="Art Files" value={artFilesCount} />
      <FieldValue label="Art Slots / Valid" value={arts} />
      <FieldValue label="Total Size" value={totalSize} />
      <Row className='form-row'>
        <div className='form-row-label'>Files</div>
        <Row className='form-row-content'>
          <ActionButton action={artEditorAction} />
        </Row>
      </Row>
      <Row className='form-row fill'>
        <Column className='form-row-content flex-fill'>
          <Column className='flex-fill'>
            <VirtualTable
              columns={COLUMNS}
              rows={files}
              selected={singleSelectionModel(values, files)}
            />
          </Column>
        </Column>
      </Row>
    </Column>
  </Column>
}