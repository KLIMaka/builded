import { createActionItem } from "@ui/action-list";
import { ActionButton, actionsToActionItem, Button, Column, Icon, NonwrapLabel, Row, Spacer, TextHeight, TextInput, useValue, useValuesContainer } from "@ui/commons";
import { MenuButton } from "@ui/menu-button";
import { row, selectIdSelectionModel, TypedTableCellProps, VirtualTable } from "@ui/table";
import { modalResult, WindowBuilder } from "@ui/windows-common";
import { Action, ActionDescriptors } from "app/apis/actions";
import { App } from "app/apis/app";
import { FileSystemHandle, FileSystems, SerializedFileSystemHandle } from "app/apis/fs";
import { Ui } from "app/apis/ui";
import { Values } from "app/apis/values";
import { stack } from "app/modules/fs/fs";
import { fsIcon } from "app/modules/fs/ui/fs-ui-utils";
import Optional from "optional-js";
import React from "react";
import { match } from "ts-pattern";
import { Source, toValuesMap, Value, ValuesContainer, ValuesMap } from "ts-utils/callbacks";
import { iter } from "ts-utils/iter";
import { sum } from "ts-utils/mathutils";
import { asyncMapOptional } from "ts-utils/objects";
import { Scheduler, TaskValue } from "ts-utils/scheduler";
import { size } from "ts-utils/size";
import { Consumer, first, notUndefined, pair } from "ts-utils/types";
import { begin } from "ts-utils/work";
import { EngineContextRecord, EngineContextType, ENGINES } from "../engine-context-api";

const ID = 'engines-context-create';

type Actions = {
  add: Record<'addStorage' | 'addDir' | 'addZip' | 'addRff' | 'addGrp' | 'addMemory', Action>,
  fs: Record<'moveUp' | 'moveDown' | 'delete', Action>
};

type FsInfoDetails = { files: number, size: number }
const EMPTY: FsInfoDetails = { files: 0, size: 0 }
type FsInfo = { type: SerializedFileSystemHandle['type'], name: string, details: Source<TaskValue<FsInfoDetails>> }

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

function FsRow(props: { info: FsInfo }) {
  const details = useValue(props.info.details);
  return <Row className='gap-10'>
    <Icon icon={fsIcon(props.info.type)} className='fa-fixwidth' />
    <NonwrapLabel label={props.info.name} />
    {details.isDone()
      ? details.result().map(d => <div> {size(d.size)} in {d.files} files(s)</div>).getOk()
      : <Icon icon="spinner" className="fa-spin-pulse" />}
  </Row>
}

function createAddItems(values: ValuesContainer, engineType: Value<Optional<EngineContextType<any>>>) {
  return values.transformed('addItems', engineType, current => iter(ENGINES)
    .map(e => createActionItem(<div>{e.name}</div>, () => engineType.set(Optional.of(e)), false, current.map(c => e === c).orElse(false)))
    .collect());
}

function FsRenderer({ cellData }: TypedTableCellProps<FsInfo, FsInfo>) {
  return <FsRow info={notUndefined(cellData)} />
}

function CreateEngineWindow(props: CreateEngineWindowProps) {
  const values = useValuesContainer(ID);
  const error = useValue(props.error);
  const valid = useValue(props.valid);
  const openEngineType = values.value('openEngineType', false);
  const addMenuOpen = values.value('addMenuOpen', false);
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
          <VirtualTable
            rows={props.fsInfos}
            columns={[row('info', 'Info', FsRenderer, 0, 1, 1)]}
            selected={selectIdSelectionModel(values, props.selected, props.fsInfos)}
            disableHeader
          />
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
    fileSystems.modImmer(fss => { [fss[s], fss[s + delta]] = [fss[s + delta], fss[s]] })
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

function createFsInfo(scheduler: Scheduler, handle: FileSystemHandle): FsInfo {
  const details = scheduler.exec(async () => asyncMapOptional(await handle.open().then(r => r.optional()), fs => fs.list())
    .then(list =>
      list.map(l => ({ size: l.map(l => l.size).reduce(sum, 0), files: l.length })).orElse(EMPTY)));
  return { name: handle.name, type: handle.serialized.type, details: details.task };
}

function createFileSystemsInfo(values: ValuesContainer, scheduler: Scheduler, fileSystems: Source<FileSystemHandle[]>): Source<FsInfo[]> {
  return values.transformed('fileSystemInfos', fileSystems, fss => fss.map(handle => createFsInfo(scheduler, handle)));
}

function createResultHandler(
  engineType: Source<Optional<EngineContextType<any>>>,
  engineMods: Source<ValuesMap<any>>,
  name: Source<string>,
  fsHandles: Source<FileSystemHandle[]>,
  fs: FileSystems,
  error: Value<Optional<Error>>,
  resultAndClose: Consumer<EngineContextRecord | null>,
  app: App,
  values: Values,
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
      const localValues = values.create('tmp-values-create-engine-context');
      const createEngine = iter(ENGINES).first(e => e.id === record.type).map(e => e.factory).orElseThrow(() => new Error(`Unknown engine type: '${record.type}' `));
      const work = begin()
        .forkItems(record.fileSystems, f => `Opening File System...`, f => fs.deserialize(f).open())
        .then('Building FS Stack...', async fss => localValues.value('fs-stack', iter(fss).map(r => r.unwrap()).reduceFirst(stack).get()))
        .thenWork((handle, fs) => createEngine(handle, fs, localValues, record.mods))
        .finishUntuple();
      const task = app.scheduler.exec(work);
      const result = await task.end();
      result
        .map(async ctx => await ctx.dispose())
        .onOk(_ => resultAndClose(record))
        .onErr(e => { app.logger.log('ERROR', e); error.set(Optional.of(e)) })
      await localValues.dispose();
    } else {
      resultAndClose(null);
    }
  }
}

export async function createEngine(ui: Ui, actionDescriptors: ActionDescriptors, fs: FileSystems, app: App, values: Values, def?: EngineContextRecord): Promise<Optional<EngineContextRecord>> {
  return values.create(ID).initializeAsync(async localValues => {
    const name = localValues.value('name', def?.name ?? '');
    const engineType = localValues.value('engineType', iter(ENGINES).first(e => e.id === def?.type));
    const engineDefault = iter(ENGINES).first(e => e.id === def?.type).map(e => e.defaultMods).orElse({});
    const engineMods = localValues.value('engineMods', toValuesMap(def?.mods ?? engineDefault, engineDefault, localValues));
    const fsHandles = localValues.value('fsHandles', iter(def?.fileSystems ?? []).map(h => fs.deserialize(h)).collect());
    const fsInfos = createFileSystemsInfo(localValues, app.scheduler, fsHandles);
    const error = localValues.value('error', Optional.empty<Error>());
    const selected = localValues.value('selected', -1);
    const clearError = () => error.set(Optional.empty());
    localValues.handleStandalone([engineType], type => { clearError(); type.ifPresent(t => engineMods.set(toValuesMap(def?.type === t.id ? def.mods : t.defaultMods, t.defaultMods, localValues))) });
    localValues.handleStandalone([fsHandles], clearError);
    const valid = localValues.transformedTuple('valid', [engineType, error, fsHandles], ([type, err, fss]) => type.isPresent() && !err.isPresent() && fss.length > 0);
    const actions = createActions(actionDescriptors, fs, fsHandles, selected, localValues);

    return new Promise<Optional<EngineContextRecord>>(ok => {
      const [resultAndClose, close] = modalResult(() => window.close(), ok);
      const result = createResultHandler(engineType, engineMods, name, fsHandles, fs, error, resultAndClose, app, values);
      const window = new WindowBuilder(ID, actionDescriptors, localValues)
        .titleFromId()
        .size(500, 350)
        .minSize(450, 300)
        .actions([...Object.values(actions.add), ...Object.values(actions.fs)])
        .onClose(close)
        .disposable(localValues)
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