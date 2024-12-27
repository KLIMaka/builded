import { ActionButton, Column, Icon, Row, Spacer, TextHeight, actionsToActionItem, useValue, useValuesContainer } from '@ui/commons';
import { MenuButton } from '@ui/menu-button';
import { SearchBox } from '@ui/search-box';
import { TypedTableCellProps, VirtualTable, VirtualTableColumn, column } from '@ui/table';
import { iter } from '@utils/iter';
import { size } from '@utils/size';
import Optional from 'optional-js';
import * as React from 'react';
import { useMemo } from 'react';
import { FileInfo, fileProvider, FileSystemsManagerImpl } from './fs-model';
import { EMPTY } from '../fs';
import { fsIcon } from './fs-ui-utils';


function Footer({ manager }: { manager: FileSystemsManagerImpl }) {
  const files = useValue(manager.files);
  const selected = useValue(manager.selected);
  const totalSize = useMemo(() => iter(files).map(f => f.size).reduceFirst((l, h) => l + h).orElse(0), [files]);
  const selectedSize = iter(selected).map(f => f.size).reduceFirst((l, h) => l + h).orElse(0);
  return (<div className='row-block window-footer flex-auto gap-5'>
    <Spacer />
    <div className='padded-5'>{size(selectedSize)} / {size(totalSize)} in {selected.size} / {files.length} file(s)</div>
  </div>)
}

function FileNameRenderer({ cellData }: TypedTableCellProps<FileInfo, string>) {
  return (<div className='row-block nonwrap-row-block baseline-aligned gap-5'>
    <div className='fa-regular fa-file' />
    <div className='nonwrap-row-block-item flex-fill'>{cellData}</div>
  </div>)
}

function FileExtRenderer({ cellData }: TypedTableCellProps<FileInfo, string>) {
  return <div>{cellData}</div>
}

function FileSizeRenderer({ cellData }: TypedTableCellProps<FileInfo, number>) {
  return <div>{size(cellData)}</div>
}

const tableColumns: VirtualTableColumn<FileInfo, any>[] = [
  column("name", "Name", FileNameRenderer, 0, 1, 1),
  column("type", "Type", FileExtRenderer, 60),
  column("size", "Size", FileSizeRenderer, 60)
];

function FilesTable({ manager }: { manager: FileSystemsManagerImpl }) {
  const selectedFs = useValue(manager.selectedFs);
  return (<Column className='padded-5 flex-fill overlay-container'>
    <VirtualTable
      key={manager.selectedFsHandle.get().map(fs => fs.name).orElse('')}
      onDrop={e => manager.writeFiles(iter(e.dataTransfer.files)
        .map(f => fileProvider(f.name, () => f.arrayBuffer().then(Optional.of)))
        .collect())}
      columns={tableColumns}
      rows={manager.files}
      selected={manager.selected}
      sort={manager.sort}
    />
    {selectedFs === EMPTY ? <div className='overlay'>Disconnected</div> : <></>}
  </Column>)
}

export function FsManagerUiImpl({ manager }: { manager: FileSystemsManagerImpl }) {
  const values = useValuesContainer('fs');

  const activeFsNameLabel = values.transformed('activeFsNameLabel', manager.selectedFsHandle, h =>
    <Row className='gap-10 baseline-aligned flex-nowrap' style={{ width: '150px' }}>
      <Icon icon={fsIcon(h.map(fs => fs.serialized.type).orElse('dir'))} />
      <div className='text-ellipsis'>{h.map(fs => fs.name).orElse('')}</div>
      <TextHeight />
    </Row>)
  const createEngineLabel = values.const('createEngineLabel',
    <Row className='gap-10 baseline-aligned'>
      <Icon icon='gears' />
      <div>Create Engine</div>
    </Row>)

  const engines = values.const('engines',
    actionsToActionItem([manager.actions.createDuke, manager.actions.createBlood, manager.actions.createFury]));


  return (
    <Column>
      <Row className='window-toolbar flex-auto'>
        <MenuButton menuMinWidth={240} openValue={manager.addMenuOpen} label={activeFsNameLabel} items={manager.storages} />
        <ActionButton action={manager.actions.refresh} />
        <ActionButton action={manager.actions.copy} />
        <ActionButton action={manager.actions.paste} />
        <ActionButton action={manager.actions.delete} />
        <MenuButton openValue={manager.createEngineOpen} label={createEngineLabel} items={engines} />
        <Spacer />
        <SearchBox value={manager.query} focusSignal={manager.searchSiganl} channelName='search' />
      </Row>
      <FilesTable manager={manager} />
      <Footer manager={manager} />
    </Column>
  );
}