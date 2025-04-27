import { ActionItem, ActionList, createActionItem } from "@ui/action-list";
import { ActionButton, actionsToActionItem, Button, Column, Icon, Row, Spacer, TextHeight, TextInput, useValue, useValuesContainer } from "@ui/commons";
import { MenuButton } from "@ui/menu-button";
import { modalResult, WindowBuilder } from "@ui/windows-common";
import { createContainer, Source, toValuesMap, Value, ValuesContainer, ValuesMap } from "@utils/callbacks";
import { iter } from "@utils/iter";
import { sum } from "@utils/mathutils";
import { asyncMapOptional } from "@utils/objects";
import { size } from "@utils/size";
import { Consumer, first, Ok, pair, Result } from "@utils/types";
import { ActionDescriptors, Actionify } from "app/apis/actions";
import { App } from "app/apis/app1";
import { FileInfo, FileSystem, FileSystemHandle, FileSystems, SerializedFileSystemHandle } from "app/apis/fs";
import { Ui } from "app/apis/ui1";
import { httpFs, stack } from "app/modules/fs/fs";
import { fsIcon } from "app/modules/fs/ui/fs-ui-utils";
import { begin } from "app/modules/scheduler/work";
import Optional from "optional-js";
import React from "react";
import { match } from "ts-pattern";
import { EngineContextRecord, EngineContextType, ENGINES } from "../engine-context-api";

const ID = 'engines-context-create';

type Actions = {
  add: Actionify<'addStorage' | 'addDir' | 'addZip' | 'addRff' | 'addGrp' | 'addMemory'>,
  fs: Actionify<'moveUp' | 'moveDown' | 'delete'>
};
type FsInfo = { handle: FileSystemHandle, disconnected: boolean, files: number, size: number }

type CreateEngineWindowProps = {
  result: Consumer<boolean>,
  name: Value<string>,
  engineType: Value<Optional<EngineContextType<any>>>,
  engineMods: Value<ValuesMap<any>>,
  fsHandles: Source<FileSystemHandle[]>,
  fsInfos: Source<FsInfo[]>,
  error: Source<Optional<Error>>,
  valid: Source<boolean>,
  actions: Actions,
  selected: Value<number>
}

function createFsItem(info: FsInfo, idx: number, currentSelected: number, selected: Value<number>): ActionItem {
  const element = <Row className='baseline-aligned gap-10'>
    <Icon icon={fsIcon(info.handle.serialized.type)} className='fa-fixwidth' />
    <div className='flex-fill'> {info.handle.name}</div>
    <div>{size(info.size)} in {info.files} files(s)</div>
  </Row>
  return createActionItem(element, () => selected.set(idx), false, idx === currentSelected);
}

function createAddItems(values: ValuesContainer, engineType: Value<Optional<EngineContextType<any>>>) {
  return values.transformed('addItems', engineType, current => iter(ENGINES)
    .map(e => createActionItem(<div>{e.name}</div>, () => engineType.set(Optional.of(e)), false, current.map(c => e === c).orElse(false)))
    .collect());
}

function CreateEngineWindow(props: CreateEngineWindowProps) {
  const values = useValuesContainer(ID);
  const error = useValue(props.error);
  const valid = useValue(props.valid);
  const selected = useValue(props.selected);
  const openEngineType = values.value('openEngineType', false);
  const addMenuOpen = values.value('addMenuOpen', false);
  const fss = values.transformed('fileItems', props.fsInfos, fss => iter(fss).enumerate().map(([info, idx]) => createFsItem(info, idx, selected, props.selected)).collect());
  const fileItems = useValue(fss);
  const engineType = useValue(props.engineType);
  const engineMods = useValue(props.engineMods);
  const addItems = values.const('addItems', actionsToActionItem(Object.values(props.actions.add)));
  const addLabel = values.const('addLabel', <Row className='gap-5 baseline-aligned'><Icon icon='plus' /> File System</Row>)
  const engineTypeLabel = values.transformed('engineTypeLabel', props.engineType, e =>
    e.map(e => <div className="flex-fill">{e.name}</div>).orElse(<div className="flex-fill"><TextHeight /></div>))

  return <Column className='padded-10 gap-10 flex-nowrap' >
    <Column className='flex-fill flex-nowrap gap-5'>
      <Row className='flex-auto baseline-aligned gap-10'>
        <div style={{ flexBasis: '100px', textAlign: 'end' }}>Name</div>
        <TextInput name='name' value={props.name} />
      </Row>
      <Row className='flex-auto baseline-aligned gap-10'>
        <div style={{ flexBasis: '100px', textAlign: 'end' }}>Type</div>
        <MenuButton openValue={openEngineType} labelAutoSize={false} label={engineTypeLabel} items={createAddItems(values, props.engineType)} />
      </Row>
      {engineType.map(type => type.modsEditor(engineMods, props.fsHandles, values)).orElse(<></>)}
      <Row className='flex-auto baseline-aligned gap-10'>
        <div style={{ flexBasis: '100px', textAlign: 'end' }}>File Systems</div>
        <Row className='flex-fill baseline-aligned gap-5'>
          <MenuButton menuMinWidth={250} items={addItems} openValue={addMenuOpen} label={addLabel} />
          <Spacer />
          <ActionButton action={props.actions.fs.moveUp} />
          <ActionButton action={props.actions.fs.moveDown} />
          <ActionButton action={props.actions.fs.delete} />
        </Row>
      </Row>
      <Row className='flex-fill gap-10' >
        <div style={{ flexBasis: '100px' }} />
        <Column className="flex-fill">
          <ActionList className='action-list-bg flex-fill' items={fileItems} stripped={true} />
        </Column>
      </Row>
    </Column>
    {error.map(e => <Row className='error gap-5 flex-auto'><Icon icon='triangle-exclamation' /><div >{e.message}</div></Row>).orElse(<></>)}
    <Row className='gap-10 flex-auto'>
      <Spacer />
      <Button
        className={`flex-auto ${valid ? 'default' : 'disabled'}`}
        style={{ width: '60px', textAlign: 'center' }}
        onClick={() => valid ? props.result(true) : 0}>
        <div>OK</div>
      </Button>
      <Button className='flex-auto' style={{ width: '60px', textAlign: 'center' }} onClick={() => props.result(false)}>Cancel</Button>
    </Row>
  </Column>
}

function createActions(actionDescriptors: ActionDescriptors, fs: FileSystems, fileSystems: Value<FileSystemHandle[]>, selected: Value<number>, values: ValuesContainer): Actions {
  const ctx = actionDescriptors.sub(ID);
  const register = (id: string, action: Consumer<void>, enabled?: Source<boolean>) => ctx.bindSync(id, action, enabled);
  const addStorage = async (type: SerializedFileSystemHandle['type']) => {
    fs.pickHandle(type).then(o => o.ifPresent(h => {
      fileSystems.setPromiseOrDispose(async fss => [h,
        ...await iter(fss)
          .map(async fs => pair(fs, await fs.isSameEntry(h)))
          .await_()
          .then(fss => fss
            .filter(([_, same]) => !same)
            .map(first)
            .collect()
          )])
    }))
  }
  const moveUpEnabled = values.transformedTuple('moveUpEnabled', [selected, fileSystems], ([s, { length }]) => s > 0 && s < length)
  const moveDownEnabled = values.transformedTuple('moveDownEnabled', [selected, fileSystems], ([s, { length }]) => s >= 0 && s < length - 1)
  const deleteEnabled = values.transformedTuple('deleteEnabled', [selected, fileSystems], ([s, { length }]) => s >= 0 && s < length)
  const deleteAction = values.transformed('deleteAction', selected, s => () => {
    if (s === 0) fileSystems.modImmer(fss => fss.shift())
    else {
      fileSystems.modImmer(fss => fss.splice(s, 1));
      selected.mod(s => s - 1);
    }
  });
  const moveAction = values.transformed('moveAction', selected, s => (dir: 'up' | 'down') => {
    const delta = match(dir)
      .with('up', () => -1)
      .with('down', () => 1)
      .exhaustive();
    selected.mod(s => s + delta);
    fileSystems.modImmer(fss => { const tmp = fss[s]; fss[s] = fss[s + delta]; fss[s + delta] = tmp })
  })
  return {
    add: {
      addStorage: register('add-storage', () => addStorage('storage')),
      addMemory: register('add-memory', () => addStorage('memory')),
      addDir: register('add-dir', () => addStorage('dir')),
      addZip: register('add-zip', () => addStorage('zip')),
      addRff: register('add-rff', () => addStorage('rff')),
      addGrp: register('add-grp', () => addStorage('grp')),
    },
    fs: {
      moveUp: register('move-up', () => moveAction.get()('up'), moveUpEnabled),
      moveDown: register('move-down', () => moveAction.get()('down'), moveDownEnabled),
      delete: register('delete', () => deleteAction.get()(), deleteEnabled),
    }
  }
}

async function createFsInfo(handle: FileSystemHandle, fs: Result<FileSystem>): Promise<FsInfo> {
  const list = await asyncMapOptional(fs.optional(), fs => fs.list())
  const fsSize = (list: FileInfo[]): number => iter(list).map(l => l.size).reduceFirst(sum).orElse(0);
  return list
    .map(l => ({ handle, size: fsSize(l), files: l.length, disconnected: false } as FsInfo))
    .orElse({ handle, size: 0, files: 0, disconnected: true })
}

async function createFileSystemsInfo(values: ValuesContainer, fileSystems: Source<FileSystemHandle[]>): Promise<Source<FsInfo[]>> {
  return values.transformedAsync('fileSystemInfos', fileSystems, fss => iter(fss)
    .map(async h => pair(h, await h.open()))
    .await_()
    .then(i => i
      .map(([h, fs]) => createFsInfo(h, fs))
      .await_()
      .then(i => i
        .collect())))
}

function createResultHandler(
  engineType: Source<Optional<EngineContextType<any>>>,
  engineMods: Source<ValuesMap<any>>,
  name: Source<string>,
  fsHandles: Source<FileSystemHandle[]>,
  fs: FileSystems,
  error: Value<Optional<Error>>,
  resultAndClose: Consumer<EngineContextRecord>,
  app: App,
) {
  return async (isOk: boolean) => {
    if (isOk) {
      const record: EngineContextRecord = {
        type: engineType.get().get().id,
        name: name.get(),
        mods: engineMods.get().getObject(),
        fileSystems: iter(fsHandles.get())
          .map(h => h.serialized)
          .collect()
      };
      const values = createContainer('tmp-values-create-engine-context');
      const createEngine = iter(ENGINES).first(e => e.id === record.type).map(e => e.factory).orElseThrow(() => new Error(`Unknown engine type: '${record.type}' `));
      const work = begin()
        .forkItems(record.fileSystems, f => `Opening File System...`, f => fs.deserialize(f).open())
        .then('Building FS Stack...', async fss => values.value('', iter(fss).map(r => r.unwrap()).reduceFirst(stack).get()))
        .thenWork((handle, fs) => createEngine(handle, fs, record.mods))
        .finishUntuple();
      const task = app.scheduler.exec(work);
      const result = await task.end();
      result
        .map(async ctx => await ctx.dispose())
        .onOk(_ => resultAndClose(record))
        .onErr(e => { app.logger.log('ERROR', e); error.set(Optional.of(e)) })
      await values.dispose();
    } else {
      resultAndClose(null);
    }
  }
}

export async function createEngine(ui: Ui, actionDescriptors: ActionDescriptors, fs: FileSystems, app: App, def?: EngineContextRecord): Promise<Optional<EngineContextRecord>> {
  return createContainer(ID).initializeAsync(async values => {
    const name = values.value('name', def?.name ?? '');
    const engineType = values.value('engineType', iter(ENGINES).first(e => e.id === def?.type));
    const engineMods = values.value('engineMods', toValuesMap(def?.mods ?? iter(ENGINES).first(e => e.id === def?.type).map(e => e.defaultMods).orElse({}), values));
    const fsHandles = values.value('fsHandles', iter(def?.fileSystems ?? []).map(h => fs.deserialize(h)).collect());
    const fsInfos = await createFileSystemsInfo(values, fsHandles);
    const error = values.value('error', Optional.empty<Error>());
    const selected = values.value('selected', -1);
    const clearError = () => error.set(Optional.empty());
    values.handleStandalone([engineType], type => { clearError(); type.ifPresent(t => engineMods.set(toValuesMap(def?.type === t.id ? def.mods : t.defaultMods, values))) });
    values.handleStandalone([fsHandles], clearError);
    const valid = values.transformedTuple('valid', [engineType, error, fsHandles], ([type, err, fss]) => type.isPresent() && !err.isPresent() && fss.length > 0);
    const actions = createActions(actionDescriptors, fs, fsHandles, selected, values);

    return new Promise<Optional<EngineContextRecord>>(ok => {
      const [resultAndClose, close] = modalResult(() => window.close(), ok);
      const result = createResultHandler(engineType, engineMods, name, fsHandles, fs, error, resultAndClose, app);
      const window = new WindowBuilder(ID, actionDescriptors, values)
        .titleFromId()
        .size(500, 350)
        .minSize(450, 300)
        .actions([...Object.values(actions.add), ...Object.values(actions.fs)])
        .onClose(close)
        .disposable(values)
        .build(<CreateEngineWindow
          result={result}
          name={name}
          engineType={engineType}
          engineMods={engineMods}
          fsHandles={fsHandles}
          fsInfos={fsInfos}
          error={error}
          valid={valid}
          actions={actions}
          selected={selected}
        />)
      ui.addWindow(window);
    });
  });
}