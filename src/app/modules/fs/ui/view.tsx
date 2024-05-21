import { ActionButton, ActionDescriptorsContext, ActionsChannelContext, Column, CurrentActionsChannelContext, Row, Spacer, TextHeight, actionsToActionItem, useValue } from '@ui/commons';
import { MenuButton } from '@ui/menu-button';
import { TypedTableCellProps, VirtualTable, VirtualTableColumn, column } from '@ui/table';
import { constSource, transformed, tuple, value } from '@utils/callbacks';
import { iter } from '@utils/iter';
import { size } from '@utils/size';
import { Consumer } from '@utils/types';
import * as React from 'react';
import { useContext, useEffect, useMemo, useRef } from 'react';
import WinBox from 'react-winbox';
import { FileInfo, StateManagerContext, fsIcon } from './model';
import { SearchBoxRef, SearchBox } from '@ui/search-box';
import { Window } from 'app/apis/ui1';
import Optional from 'optional-js';


function Footer() {
  const manager = useContext(StateManagerContext);
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

function readFile(file: File): Promise<Optional<ArrayBuffer>> {
  const fileReader = new FileReader();
  fileReader.readAsArrayBuffer(file);
  return new Promise((ok, error) => {
    fileReader.onload = e => ok(Optional.of(e.target.result as ArrayBuffer));
    fileReader.onerror = e => error(e);
  })
}

function FilesTable() {
  const manager = useContext(StateManagerContext);
  const tableColumns: VirtualTableColumn<FileInfo, any>[] = [
    column("name", "Name", FileNameRenderer, 0, 1, 1),
    column("type", "Type", FileExtRenderer, 60),
    column("size", "Size", FileSizeRenderer, 60)
  ];
  return (<div className='padded-5 column-block flex-fill'>
    <VirtualTable
      key={manager.selectedFsName.get()}
      onDrop={e => manager.writeFiles(iter(e.dataTransfer.files).map(f => { return { name: f.name, provider: () => readFile(f) } }).collect())}
      columns={tableColumns}
      rows={manager.files}
      selected={manager.selected}
      sort={manager.sort}
    />
  </div>)
}

export function FsManagerUiImpl({ onClose, name, windowConsumer }: { onClose: Consumer<void>, name: string, windowConsumer: Consumer<Window> }) {
  const manager = useContext(StateManagerContext);
  const actionDescriptors = useContext(ActionDescriptorsContext);
  const currentActions = useContext(CurrentActionsChannelContext);
  const actionsChannel = useContext(ActionsChannelContext);
  const channel = actionsChannel.child(name);
  const winRef = useRef<WinBox>();
  const searchRef = useRef<SearchBoxRef>();
  const addMenuOpen = value(false);

  const activeFsNameLabel = transformed(tuple(manager.selectedFsName, manager.selectedFs), ([label, fs]) =>
    <div className='row-block gap-10 baseline-aligned flex-nowrap' style={{ width: '150px' }}>
      <div className={`fa-solid ${fsIcon(fs.map(fs => fs.type()).orElse(''))}`} />
      <div className='text-ellipsis'>{label}</div>
      <TextHeight />
    </div>);

  const createEngineLabel = constSource(<div className='row-block gap-10 baseline-aligned'>
    <div className='fa-solid fa-gears' />
    <div>Create Engine</div>
  </div>);
  const engines = constSource(actionsToActionItem([manager.actions.createDuke, manager.actions.createBlood, manager.actions.createFury]));

  useEffect(() => {
    windowConsumer({ winbox: winRef.current })
    const ctx = actionDescriptors.sub('win');
    const fsCtx = actionDescriptors.sub('fs');
    manager.setChannel(channel);
    return channel.collector().add(
      ctx.bindSync('close', () => winRef.current.minimize()),
      fsCtx.bindSync('add-menu', () => addMenuOpen.set(true)),
      fsCtx.bindSync('search', () => searchRef.current.focus()),
      ...Object.values(manager.actions),
    );
  }, [actionDescriptors, addMenuOpen, channel, manager, windowConsumer]);

  return (
    <ActionsChannelContext.Provider value={channel}>
      <WinBox
        ref={winRef}
        title="File System"
        className="window"
        x={manager.state.get().x}
        y={manager.state.get().y}
        noFull={true}
        width={manager.state.get().width}
        height={manager.state.get().height}
        minHeight={400}
        minWidth={400}
        onClose={_ => onClose()}
        onFocus={() => currentActions(channel)}
        onResize={(w, h) => manager.setSize(w, h)}
        onMove={(x, y) => manager.setPosition(x, y)}
      >
        <Column>
          <Row className='window-toolbar flex-auto'>
            <MenuButton menuMinWidth={240} openValue={addMenuOpen} label={activeFsNameLabel} items={manager.storages} />
            <ActionButton action={manager.actions.refresh} />
            <ActionButton action={manager.actions.copy} />
            <ActionButton action={manager.actions.paste} />
            <ActionButton action={manager.actions.delete} />
            <MenuButton openValue={value(false)} label={createEngineLabel} items={engines} />
            <Spacer />
            <SearchBox ref={searchRef} value={manager.query} channelName='search' />
          </Row>
          <FilesTable />
          <Footer />
        </Column>
      </WinBox>
    </ActionsChannelContext.Provider>
  );
}