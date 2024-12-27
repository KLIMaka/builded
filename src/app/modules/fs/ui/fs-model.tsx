import { ActionItem } from "@ui/action-list";
import { Icon, actionsToActionItem, line } from "@ui/commons";
import { confirm, info } from "@ui/message-box";
import { Sort } from "@ui/table";
import { SizeType, WindowBuilder } from "@ui/windows-common";
import { Signal, Source, Value, ValuesContainer, ValuesMap, createContainer } from "@utils/callbacks";
import { Dependency, Injector, getInstances, lifecycle } from "@utils/injector";
import { iter } from "@utils/iter";
import { UniqueIds, asyncMapOptional, zipOptional } from "@utils/objects";
import { size } from "@utils/size";
import { debounced } from "@utils/time";
import { Consumer, Supplier, identity, pair } from "@utils/types";
import { ACTION_DESCRIPTORS, Action, ActionDescriptors } from "app/apis/actions";
import { APP, App, Storage } from "app/apis/app1";
import { FS, FileSystem, FileSystemHandle, FileSystems, SerializedFileSystemHandle } from "app/apis/fs";
import { UI, Ui, Window } from "app/apis/ui1";
import { createSavedState } from "app/modules/default/app/storage";
import { waitFor } from "app/modules/scheduler/ui/task-propgress";
import { WorkBuilder } from "app/modules/scheduler/work";
import Optional from "optional-js";
import * as React from 'react';
import { EMPTY } from "../fs";
import { FsManagerUiImpl } from "./fs-model-view";
import { fsIcon } from "./fs-ui-utils";
import { OverwriteOption, confirmOverwrite } from "./overwrite";

const GLOBAL = 'fs.global';
const LOCAL = 'fs.';

function getExtension(s: string) {
  const idx = s.lastIndexOf('.');
  return idx === -1 ? "" : s.substring(idx + 1).toUpperCase()
}

export type GlobalFileSystemsManager = {
  newWindow(): Promise<Window>;
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
  sort: Sort,
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
  private ids = new UniqueIds();

  constructor(
    private values: ValuesContainer,
    private state: ValuesMap<GlobalSavedState>,
    readonly app: App,
    readonly fs: FileSystems,
    private storage: Storage,
    readonly ui: Ui,
    readonly actionDescriptors: ActionDescriptors,
    readonly injector: Injector,
  ) {
    this.clipboard = this.values.value('clipboard', Optional.empty());
    this.recentFss = values.transformed('recentFss', state.get('recent'), r => r.map(r => fs.deserialize(r)));
  }

  async addRecent(handle: FileSystemHandle) {
    this.state.get('recent').setPromise(async recent => [
      handle.serialized,
      ...await iter(recent)
        .map(s => this.fs.deserialize(s))
        .map(async h => pair(h, await h.isSameEntry(handle)))
        .await_().then(i => i
          .filter(([_, same]) => !same)
          .map(([h, _]) => h.serialized)
          .collect())
    ]);
  }

  async newWindow(): Promise<Window> {
    const id = this.ids.get();
    const name = LOCAL + id.value;
    const values = createContainer(name);
    const savedState = await createSavedState(values, this.storage, name, createDefaultSavedState());
    const manager = new FileSystemsManagerImpl(values, savedState, this);
    return new WindowBuilder(name, this.actionDescriptors, values)
      .title('File Systems')
      .minSize(400, 400)
      .sizeValue(savedState.get('size'))
      .positionValue(savedState.get('position'))
      .onClose(() => this.app.timer.delayed(() => values.dispose()))
      .actions(Object.values(manager.actions))
      .disposable(id)
      .build(<FsManagerUiImpl manager={manager} />)
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
  readonly sort: Value<Sort>;
  readonly storages: Source<ActionItem[]>
  readonly actions: ManagerActions;
  readonly selected: Value<Set<FileInfo>>;
  readonly query: Value<string>;
  readonly addMenuOpen: Value<boolean>;
  readonly createEngineOpen: Value<boolean>;
  readonly searchSiganl: Signal<[]>;

  constructor(
    readonly values: ValuesContainer,
    readonly state: ValuesMap<SavedState>,
    private global: GlobalFileSystemsManagerImpl,
  ) {
    this.selected = this.values.value<Set<FileInfo>>('selected', new Set())
    this.query = this.values.value('query', '');
    this.selectedFsHandle = this.values.value('selectedFsHandle', Optional.empty());
    this.selectedFs = this.createSelectedFs(this.selectedFsHandle);
    this.sort = state.get('sort');
    [this.loadedFiles, this.reloadFiles] = this.createLoadedFiles(this.selectedFs);
    this.files = this.createFiles(this.loadedFiles, this.sort, this.query);
    this.actions = this.createActions(global.actionDescriptors, this.createRecentConsumer());
    this.storages = this.createStorages(global.recentFss, this.selectedFsHandle,
      [this.actions.addStorage, this.actions.addDir, this.actions.addZip, this.actions.addRff, this.actions.addGrp]);
    this.addMenuOpen = values.value('addMenuOpen', false);
    this.createEngineOpen = values.value('createEngineOpen', false);
    this.searchSiganl = values.signal();
  }

  private createSelectedFs(handle: Source<Optional<FileSystemHandle>>): Value<FileSystem> {
    return this.values.transformedAsyncImmediate('selectedFs', handle, EMPTY,
      h => asyncMapOptional(h, h => h.open().then(fs => fs.optional().orElse(EMPTY)))
        .then(o => o.orElse(EMPTY)));
  }

  private createLoadedFiles(source: Source<FileSystem>): [Source<FileInfo[]>, Consumer<void>] {
    const transformer = async (fs: FileSystem) => {
      this.selected.set(new Set());
      const files = await fs.list();
      return files.map(f => { return { name: f.name, size: f.size, type: getExtension(f.name) } })
    }
    const debouncedReload = debounced(() => loadedFiles.forceReload(), 100);
    const srcConnector = (fs: FileSystem, _: Value<FileInfo[]>) => fs.subscribe((name, deleted) => debouncedReload());
    const value = [];
    const loadedFiles = this.values.transformedAsyncBuilder({ name: 'loadedFiles', source, transformer, value, srcConnector });
    return [loadedFiles, () => loadedFiles.forceReload()];
  }

  private createFiles(files: Source<FileInfo[]>, sort: Source<Sort>, query: Source<string>): Source<FileInfo[]> {
    return this.values.transformedTuple('files', [files, sort, query], ([files, sort, query]) => {
      const queryLc = query.toLowerCase();
      const filtered = files.filter(f => f.name.toLowerCase().includes(queryLc));
      if (sort.column === undefined) return filtered;
      const [dirG, dirL] = sort.direction === 'ASC' ? [-1, 1] : [1, -1];
      return [...filtered.sort((l, r) => l[sort.column] < r[sort.column] ? dirG : dirL)];
    });
  }

  private createStorages(recent: Source<FileSystemHandle[]>, activeFsHandle: Value<Optional<FileSystemHandle>>, addActions: Action[]): Source<ActionItem[]> {
    return this.values.transformedTuple('storages', [recent, activeFsHandle],
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
    const nonEmptySelection = this.values.transformed('nonEmptySelection', this.selected, s => s.size !== 0);
    const nonEmptyClipboard = this.values.transformed('nonEmptyClipboard', this.global.clipboard, c => c.isPresent());
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
    this.global.clipboard.set(Optional.of({ fs: this.selectedFs.get(), files: iter(this.selected.get()).map(f => f.name).collect() }));
  }

  private async paste() {
    this.global.clipboard.get().ifPresent(({ fs, files }) =>
      this.writeFiles(files.map(f => { return { name: f, provider: () => fs.read(f) } })))
  }

  private async delete() {
    const selected = this.selected.get();
    const isOk = await confirm(this.global.ui, this.global.actionDescriptors, 'Delete', `Do you really want to delete the ${selected.size} selected files(s)?`);
    if (!isOk.orElse(false)) return;
    await this.selectedFs.get().writable().then(w => w.ifPresent(async writable => {
      const scheduler = this.global.app.scheduler;
      const task = scheduler.exec(new WorkBuilder()
        .forkItems(selected, f => `Deleting ${f.name}...`, f => writable.delete(f.name))
        .finish()
      );
      await waitFor(this.global.ui, this.global.actionDescriptors, "Delete", task);
    }));
  }

  async writeFiles(files: FileProvider[]) {
    await this.selectedFs.get().writable().then(w => w.ifPresent(async w => {
      const scheduler = this.global.app.scheduler;
      const task = scheduler.exec(new WorkBuilder()
        .then('Preparing...', async () => this.selectedFs.get().list())
        .factory((work, dstFiles) => {
          const filesMap = iter(dstFiles).toMap(f => f.name.toLowerCase(), identity());
          const checkFile = async (name: string, byteLength: number) => {
            const fn = name;
            const dstFile = filesMap.get(fn.toLowerCase());
            if (!dstFile) return 'yes';
            const text = `Do you really want to overwrite file '${fn}'? Old size ${size(dstFile.size)} new size ${size(byteLength)}`;
            const isOk = await confirmOverwrite(this.global.ui, this.global.actionDescriptors, 'Overwrite', text)
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
                      .catch(e => info(this.global.ui, this.global.actionDescriptors, 'Error', e.message))
                      .then(_ => option)
                ).then(o => o.orElse(prevOption)))
            ).finish(['yes']);
        }).finish());
      const result = await waitFor(this.global.ui, this.global.actionDescriptors, "Write", task);
      result.onErr(e => { this.global.app.logger.log('ERROR', e); info(this.global.ui, this.global.actionDescriptors, 'Error', e.message) })
    }));
  }
}

export const FileSystemsManagerModule = lifecycle<GlobalFileSystemsManager>(async (injector, lifecycle) => {
  const [fs, actionDescriptors, app, ui] = await getInstances(injector, FS, ACTION_DESCRIPTORS, APP, UI);
  const globalValues = lifecycle(createContainer('fs-global'), async c => c.dispose());
  const windowStates = lifecycle(await app.storages('ui.window-states'), async s => s.dispose());
  const globalState = await createSavedState(globalValues, windowStates, GLOBAL, createDefaultGlobalState());
  return new GlobalFileSystemsManagerImpl(globalValues, globalState, app, fs, windowStates, ui, actionDescriptors, injector);
});

export const FS_MANAGER = new Dependency<GlobalFileSystemsManager>('File Systems Manager');