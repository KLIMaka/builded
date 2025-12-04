import { ActionItem } from "@ui/action-list";
import { Icon, actionsToActionItem, line } from "@ui/commons";
import { confirm, info } from "@ui/message-box";
import { SelectionController, Sort, setSelectionModel } from "@ui/table";
import { SizeType, WindowBuilder } from "@ui/windows-common";
import { ACTION_DESCRIPTORS, Action, ActionDescriptors } from "app/apis/actions";
import { APP, App, Storage } from "app/apis/app";
import { FS, FileSystem, FileSystemHandle, FileSystems, SerializedFileSystemHandle } from "app/apis/fs";
import { UI, Ui, Window } from "app/apis/ui";
import { VALUES, Values } from "app/apis/values";
import { createSavedState } from "app/modules/default/app/storage";
import { waitFor } from "app/modules/scheduler/ui/task-propgress";
import Optional from "optional-js";
import * as React from 'react';
import { Signal, Source, Value, ValuesContainer, ValuesMap, initial } from "ts-utils/callbacks";
import { Dependency, getInstances, lifecycle } from "ts-utils/injector";
import { iter } from "ts-utils/iter";
import { asyncMapOptional, zipOptional } from "ts-utils/objects";
import { size } from "ts-utils/size";
import { Consumer, Supplier, identity, pair } from "ts-utils/types";
import { begin } from "ts-utils/work";
import { EMPTY } from "../fs";
import { FsManagerUiImpl } from "./fs-model-view";
import { fsIcon } from "./fs-ui-utils";
import { OverwriteOption, confirmOverwrite } from "./overwrite";

const GLOBAL = 'fs.global';
const LOCAL = 'fs';

function getExtension(s: string) {
  const idx = s.lastIndexOf('.');
  return idx === -1 ? "" : s.substring(idx + 1).toUpperCase()
}

export type GlobalFileSystemsManager = {
  openWindow(): Promise<Window>;
}

export type FileInfo = { name: string, type: string, size: number }
export type FileProvider = { name: string, provider: Supplier<Promise<Optional<ArrayBuffer>>> }
export function fileProvider(name: string, provider: Supplier<Promise<Optional<ArrayBuffer>>>): FileProvider { return { name, provider } }

type GlobalSavedState = {
  recent: SerializedFileSystemHandle[]
}

function createDefaultGlobalState(): GlobalSavedState {
  return { recent: [] }
}

type FilesList = {
  fs: FileSystem,
  files: string[]
}

type SavedState = {
  position: SizeType,
  size: SizeType,
  selectedFsName: string,
  sort: Sort<FileInfo>,
}

function createDefaultSavedState(): SavedState {
  return {
    position: ['center', 'center'],
    size: [600, 600],
    selectedFsName: "",
    sort: { column: undefined, direction: undefined }
  };
}

class GlobalFileSystemsManagerImpl implements GlobalFileSystemsManager {
  readonly clipboard: Value<Optional<FilesList>>;
  readonly recentFss: Source<FileSystemHandle[]>;
  private window: Window | undefined;

  constructor(
    readonly values: Values,
    private localValues: ValuesContainer,
    private state: ValuesMap<GlobalSavedState>,
    readonly app: App,
    readonly fs: FileSystems,
    private storage: Storage,
    readonly ui: Ui,
    readonly actionDescriptors: ActionDescriptors,
  ) {
    this.clipboard = this.localValues.value('clipboard', Optional.empty());
    this.recentFss = localValues.transformed('recentFss', state.get('recent'), r => r.map(r => fs.deserialize(r)));
  }

  async addRecent(handle: FileSystemHandle) {
    this.state.get('recent').setPromiseOrDispose(async recent => [
      handle.serialized,
      ...await iter(recent)
        .map(s => this.fs.deserialize(s))
        .map(async h => pair(h, await h.isSameEntry(handle)))
        .await_()
        .then(i => i
          .filter(([_, same]) => !same)
          .map(([h, _]) => h.serialized)
          .collect())
    ]);
  }

  async openWindow(): Promise<Window> {
    if (this.window !== undefined) return this.window;
    const values = this.values.create(LOCAL);
    const savedState = await createSavedState(values, this.storage, LOCAL, createDefaultSavedState(), this.app.timer);
    const manager = new FileSystemsManagerImpl(values, savedState, this);
    this.window = new WindowBuilder(LOCAL, this.actionDescriptors, values)
      .title('File Systems')
      .minSize(400, 400)
      .state(savedState)
      .onClose(() => this.app.timer.delayed(() => values.dispose()))
      .onClose(() => this.window = undefined)
      .actions(Object.values(manager.actions))
      .build(<FsManagerUiImpl manager={manager} />)
    return this.window;
  }
}

type ManagerActions = {
  addDir: Action,
  addZip: Action,
  addRff: Action,
  addGrp: Action,
  addStorage: Action,
  refresh: Action,
  copy: Action,
  paste: Action,
  delete: Action,
  createBlood: Action,
  createDuke: Action,
  createFury: Action,
  addMenuOpen: Action,
  ceateEngineOpen: Action,
  search: Action,
  clearSearch: Action,
}

export class FileSystemsManagerImpl {
  readonly selectedFsHandle: Value<Optional<FileSystemHandle>>;
  readonly selectedFs: Value<FileSystem>;
  readonly loadedFiles: Source<FileInfo[]>;
  readonly reloadFiles: Consumer<void>;
  readonly files: Source<FileInfo[]>;
  readonly sort: Value<Sort<FileInfo>>;
  readonly storages: Source<ActionItem[]>
  readonly actions: ManagerActions;
  readonly selected: Source<SelectionController<FileInfo>>;
  readonly query: Value<string>;
  readonly addMenuOpen: Value<boolean>;
  readonly createEngineOpen: Value<boolean>;
  readonly searchSiganl: Signal<[]>;

  constructor(
    readonly localValues: ValuesContainer,
    readonly state: ValuesMap<SavedState>,
    private global: GlobalFileSystemsManagerImpl,
  ) {
    this.query = this.localValues.value('query', '');
    this.selectedFsHandle = this.localValues.value('selectedFsHandle', Optional.empty());
    this.selectedFs = this.createSelectedFs(this.selectedFsHandle);
    this.sort = state.get('sort');
    [this.loadedFiles, this.reloadFiles] = this.createLoadedFiles(this.selectedFs);
    this.files = this.createFiles(this.loadedFiles, this.sort, this.query);
    this.selected = setSelectionModel(this.localValues, this.files);
    this.localValues.handleStandalone([this.selectedFs], _ => { this.selected.get().unselectAll() });
    this.actions = this.createActions(global.actionDescriptors, this.createRecentConsumer());
    this.storages = this.createStorages(global.recentFss, this.selectedFsHandle,
      [this.actions.addStorage, this.actions.addDir, this.actions.addZip, this.actions.addRff, this.actions.addGrp]);
    this.addMenuOpen = localValues.value('addMenuOpen', false);
    this.createEngineOpen = localValues.value('createEngineOpen', false);
    this.searchSiganl = localValues.signal();
  }

  private createSelectedFs(handle: Source<Optional<FileSystemHandle>>): Value<FileSystem> {
    return this.localValues.transformedAsyncBuilder({
      name: 'selectedFs',
      source: handle,
      initialValue: initial(EMPTY),
      transformer: h => asyncMapOptional(h, h => h.open().then(fs => fs.optional().orElse(EMPTY))).then(o => o.orElse(EMPTY))
    });
  }

  private createLoadedFiles(source: Source<FileSystem>): [Source<FileInfo[]>, Consumer<void>] {
    const transformer = async (fs: FileSystem) => {
      const files = await fs.list();
      return files.map(f => { return { name: f.name, size: f.size, type: getExtension(f.name) } })
    }
    const debouncedReload = this.global.app.timer.debounced(() => loadedFiles.forceReload(), 100);
    this.localValues.addDisposable(debouncedReload);
    const srcConnector = (fs: FileSystem, _: Value<FileInfo[]>) => fs.subscribe((name, deleted) => debouncedReload.run());
    const loadedFiles = this.localValues.transformedAsyncBuilder({ name: 'loadedFiles', source, transformer, initialValue: initial<FileInfo[]>([]), srcConnector });
    return [loadedFiles, () => loadedFiles.forceReload()];
  }

  private createFiles(files: Source<FileInfo[]>, sort: Source<Sort<FileInfo>>, query: Source<string>): Source<FileInfo[]> {
    return this.localValues.transformedTuple('files', [files, sort, query], ([files, sort, query]) => {
      const queryLc = query.toLowerCase();
      const filtered = files.filter(f => f.name.toLowerCase().includes(queryLc));
      const sortColumn = sort.column;
      if (sortColumn === undefined) return filtered;
      const [dirG, dirL] = sort.direction === 'ASC' ? [-1, 1] : [1, -1];
      return [...filtered.sort((l, r) => l[sortColumn] < r[sortColumn] ? dirG : dirL)];
    });
  }

  private createStorages(recent: Source<FileSystemHandle[]>, activeFsHandle: Value<Optional<FileSystemHandle>>, addActions: Action[]): Source<ActionItem[]> {
    return this.localValues.transformedTuple('storages', [recent, activeFsHandle],
      ([recent, _]) => [
        ...recent.map(handle => this.createFsItem(handle)),
        line('Add'),
        ...actionsToActionItem(addActions)
      ]);
  }

  private createFsItem(handle: FileSystemHandle): ActionItem {
    return {
      element: <div className='menu-item row-block'>
        <Icon className='fa-fixwidth' icon={fsIcon(handle.serialized.type)} />
        <div className="flex-fill text-ellipsis text-stretch"> {handle.name} </div>
      </div>,
      selected: this.selectedFsHandle.get().map(h => h === handle).orElse(false),
      action: async () => this.selectedFsHandle.set(Optional.of(handle))
    }
  }

  private createRecentConsumer(): Consumer<SerializedFileSystemHandle['type']> {
    return async type => this.global.fs.pickHandle(type).then(r => r.ifPresent(async res => {
      this.global.addRecent(res);
      this.selectedFsHandle.set(Optional.of(res));
    }))
  }

  private createActions(actionDescriptors: ActionDescriptors, recentConsumer: Consumer<SerializedFileSystemHandle['type']>): ManagerActions {
    const fsCtx = actionDescriptors.sub('fs');
    const nonEmptySelection = this.localValues.transformed('nonEmptySelection', this.selected, s => s.selected().length !== 0);
    const nonEmptyClipboard = this.localValues.transformed('nonEmptyClipboard', this.global.clipboard, c => c.isPresent());
    const register = (id: string, action: Consumer<void>, enabled?: Source<boolean>) => fsCtx.bindSync(id, action, enabled);
    return {
      addDir: register('add-dir', () => recentConsumer('dir')),
      addZip: register('add-zip', () => recentConsumer('zip')),
      addRff: register('add-rff', () => recentConsumer('rff')),
      addGrp: register('add-grp', () => recentConsumer('grp')),
      addStorage: register('add-storage', () => recentConsumer('storage')),
      refresh: register('refresh', () => this.reloadFiles()),
      delete: register('delete', () => this.delete(), nonEmptySelection),
      copy: register('copy', () => this.copy(), nonEmptySelection),
      paste: register('paste', () => this.paste(), nonEmptyClipboard),
      createBlood: register('create-engine-blood', () => { }),
      createFury: register('create-engine-fury', () => { }),
      createDuke: register('create-engine-duke', () => { }),
      addMenuOpen: register('add-menu', () => this.addMenuOpen.set(true)),
      ceateEngineOpen: register('create-engine', () => this.createEngineOpen.set(true)),
      search: register('search', () => this.searchSiganl.call()),
      clearSearch: register('clear-search', () => this.query.set(''))
    }
  }

  private copy() {
    this.global.clipboard.set(Optional.of({ fs: this.selectedFs.get(), files: iter(this.selected.get().selected()).map(f => f.name).collect() }));
  }

  private async paste() {
    this.global.clipboard.get().ifPresent(({ fs, files }) =>
      this.writeFiles(files.map(f => { return { name: f, provider: () => fs.read(f) } })))
  }

  private async delete() {
    const selected = this.selected.get().selected();
    const isOk = await confirm(this.global.ui, this.global.actionDescriptors, this.global.values, 'Delete', `Do you really want to delete the ${selected.length} selected files(s)?`);
    if (!isOk.orElse(false)) return;
    await this.selectedFs.get().writable().then(w => w.ifPresent(async writable => {
      const scheduler = this.global.app.scheduler;
      const task = scheduler.exec(begin()
        .forkItems(selected, f => `Deleting ${f.name}...`, f => writable.delete(f.name))
        .finish()
      );
      await waitFor(this.global.ui, this.global.actionDescriptors, this.global.values, "Delete", task);
    }));
  }

  async writeFiles(files: FileProvider[]) {
    await this.selectedFs.get().writable().then(w => w.ifPresent(async w => {
      const scheduler = this.global.app.scheduler;
      const task = scheduler.exec(begin()
        .then('Preparing...', async () => this.selectedFs.get().list())
        .factory((work, dstFiles) => {
          const filesMap = iter(dstFiles).toMap(f => f.name.toLowerCase(), identity());
          const checkFile = async (name: string, byteLength: number) => {
            const fn = name;
            const dstFile = filesMap.get(fn.toLowerCase());
            if (!dstFile) return 'yes';
            const text = `Do you really want to overwrite file '${fn}'? Old size ${size(dstFile.size)} new size ${size(byteLength)}`;
            const isOk = await confirmOverwrite(this.global.ui, this.global.actionDescriptors, this.global.values, 'Overwrite', text)
            return isOk.orElse('all-no')
          }
          return work.input<OverwriteOption>()
            .append(files, (work, file) => work
              .thenPass(`Writing ${file.name}...`, async option => option === 'all-no'
                ? Optional.empty<ArrayBuffer>()
                : file.provider())
              .thenPass(`Writing ${file.name}...`, async (option, data) => option === 'all-yes'
                ? Optional.of(option)
                : asyncMapOptional(data, data => checkFile(file.name, data.byteLength)))
              .then(`Writing ${file.name}...`, async (prevOption, data, checkOption) =>
                asyncMapOptional(zipOptional(checkOption, data), async ([option, data]) =>
                  (option === 'all-no' || option === 'no')
                    ? option
                    : w.write(file.name, data)
                      .catch(e => info(this.global.ui, this.global.actionDescriptors, this.global.values, 'Error', e.message))
                      .then(_ => option)
                ).then(o => o.orElse(prevOption)))
            ).finish(['yes']);
        }).finish());
      const result = await waitFor(this.global.ui, this.global.actionDescriptors, this.global.values, "Write", task);
      result.onErr(e => { this.global.app.logger.log('ERROR', e); info(this.global.ui, this.global.actionDescriptors, this.global.values, 'Error', e.message) })
    }));
  }
}

export const FileSystemsManagerModule = lifecycle<GlobalFileSystemsManager>(async (injector, lifecycle) => {
  const [fs, actionDescriptors, app, ui, values] = await getInstances(injector, FS, ACTION_DESCRIPTORS, APP, UI, VALUES);
  const globalValues = lifecycle(values.create(GLOBAL), async c => c.dispose());
  const windowStates = lifecycle(await app.storages('ui.window-states'), async s => s.dispose());
  const globalState = await createSavedState(globalValues, windowStates, GLOBAL, createDefaultGlobalState(), app.timer);
  return new GlobalFileSystemsManagerImpl(values, globalValues, globalState, app, fs, windowStates, ui, actionDescriptors);
});

export const FS_MANAGER = new Dependency<GlobalFileSystemsManager>('File Systems Manager');