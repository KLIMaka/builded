import { ActionItem, createActionItem } from "@ui/action-list";
import { Button, Column, Icon, Row, Spacer, useValue, useValuesContainer } from "@ui/commons";
import { MenuButton } from "@ui/menu-button";
import { inputText } from "@ui/message-box";
import { modalResult, WindowBuilder } from "@ui/windows-common";
import { createContainer, Source, Value } from "ts-utils/callbacks";
import { iter } from "ts-utils/iter";
import { sum } from "ts-utils/mathutils";
import { size } from "ts-utils/size";
import { Consumer, unwrapOptionalPromise } from "ts-utils/types";
import { ActionDescriptors } from "app/apis/actions";
import { App } from "app/apis/app1";
import { FileInfo, FileSystems } from "app/apis/fs";
import { Ui } from "app/apis/ui1";
import { storageValue } from "app/modules/default/app/storage";
import Optional from "optional-js";
import React from "react";

const ID = 'select-storage-fs';

type FsInfo = {
  name: string,
  files: number,
  size: number,
}

type SelectStorageProps = {
  result: Consumer<boolean>,
  storageNames: Value<string[]>,
  storageInfos: Source<ActionItem[]>,
  selected: Source<Optional<FsInfo>>
  isSelected: Source<boolean>,
  addNew: Consumer<void>
}

function SelectStorage(props: SelectStorageProps) {
  const values = useValuesContainer(ID);
  const isSelected = useValue(props.isSelected);
  const label = values.transformed('label', props.selected, s => s.map(i =>
    <Row className="gap-5 flex-fill baseline-aligned">
      <Icon icon="database" className="fa-fixwidth" />
      <div>{i.name}</div>
    </Row>)
    .orElse(<div className='flex-fill' />))
  const open = values.value('open', false);

  return <Column className='gap-10 padded-10'>
    <Row className="gap-10">
      <Icon icon='database' className='padded-10' style={{ fontSize: 32, alignContent: 'center' }} />
      <Column className='flex-fill baseline-aligned gap-10'>
        <div className='flex-auto'>Select Storage</div>
        <Row className='flex-auto gap-5' style={{ alignSelf: 'stretch' }}>
          <MenuButton items={props.storageInfos} label={label} labelAutoSize={false} openValue={open} />
          <Button className='flex-auto' onClick={e => props.addNew()}><Icon icon='plus' /></Button>
        </Row>
      </Column>
    </Row>
    <Row className='gap-10 flex-auto'>
      <Spacer />
      <Button
        className={`flex-auto ${isSelected ? 'default' : 'disabled'}`}
        style={{ width: '60px', textAlign: 'center' }}
        onClick={() => isSelected ? props.result(true) : 0}>
        <div>OK</div>
      </Button>
      <Button className='flex-auto' style={{ width: '60px', textAlign: 'center' }} onClick={() => props.result(false)}>Cancel</Button>
    </Row>
  </Column>
}

function getFsInfo(name: string, list: FileInfo[]): FsInfo {
  const size = iter(list)
    .map(l => l.size)
    .reduceFirst(sum)
    .orElse(0);
  const files = list.length;
  return { name, files, size };
}

async function getFilesList(name: string, fs: FileSystems): Promise<Optional<FileInfo[]>> {
  const fsr = await fs.deserialize({ type: 'storage', name }).open();
  return unwrapOptionalPromise(fsr.optional().map(fs => fs.list()))
}

function createFsActionItem(info: FsInfo, selected: Value<Optional<FsInfo>>): ActionItem {
  const element = <Row className="baseline-aligned gap-5">
    <Icon icon='database' className='fa-fixwidth' />
    <div className='flex-fill'>{info.name}</div>
    <div className='flex-auto'>{size(info.size)} in {info.files} file(s)</div>
  </Row>
  return createActionItem(element, () => selected.set(Optional.of(info)));
}

export async function selectStorageFs(app: App, ui: Ui, aDescriptors: ActionDescriptors, fs: FileSystems): Promise<Optional<string>> {
  const values = createContainer(ID);
  const globalStorage = await app.storages('global');
  const storageNames = await storageValue(values, globalStorage, `${ID}.storages`, [] as string[]);
  const selected = values.value('selected', Optional.empty<FsInfo>());
  const isSelected = values.transformed('isSelected', selected, s => s.isPresent());
  const storageInfos = await values.transformedAsync('storageInfos', storageNames, async names => (await iter(names)
    .map(async name => (await getFilesList(name, fs)).map(l => getFsInfo(name, l)))
    .await_())
    .filter(o => o.isPresent())
    .map(o => o.get())
    .map(i => createFsActionItem(i, selected))
    .collect());
  const addNew = async () => {
    (await inputText(app, ui, aDescriptors, 'Input Name', 'Input new storage name', 'database', '', 400, 130))
      .ifPresent(n => storageNames.mod(s => [n, ...s.filter(s => s !== n)]));
  }

  return new Promise<Optional<string>>(async (ok, error) => {
    const [resultAndClose, close] = modalResult(() => window.close(), ok);
    const result = (isOk: boolean) => isOk ? resultAndClose(selected.get().get().name) : resultAndClose(null)

    const window = new WindowBuilder(ID, aDescriptors, values)
      .modal()
      .titleFromId()
      .size(450, 130)
      .action('close', () => result(false))
      .action('add-storage', () => addNew())
      .action('select', () => result(true), isSelected)
      .onClose(close)
      .disposable(values)
      .build(<SelectStorage
        result={result}
        storageNames={storageNames}
        storageInfos={storageInfos}
        selected={selected}
        isSelected={isSelected}
        addNew={addNew}
      />)
    ui.addWindow(window);
  });
}