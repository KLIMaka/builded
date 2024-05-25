import { ActionItem } from "@ui/action-list";
import { ActionsNode, actionsToActionItem, line } from "@ui/commons";
import { confirm, info } from "@ui/message-box";
import { Sort } from "@ui/table";
import { Disconnector, Source, Value, transformed, transformedAsyncImmediate, tuple, value } from "@utils/callbacks";
import { Dependency, Injector, getInstances, provider } from "@utils/injector";
import { iter } from "@utils/iter";
import { applyDefaults, asyncFlatMapOptional } from "@utils/objects";
import { size } from "@utils/size";
import { debounced } from "@utils/time";
import { Consumer, Function, Supplier, identity, nil, seq } from "@utils/types";
import { ACTION_DESCRIPTORS, Action, ActionDescriptors } from "app/apis/actions";
import { APP, App, Storage } from "app/apis/app1";
import { EngineContext } from "app/apis/engine";
import { FS, FileSystem, FileSystems } from "app/apis/fs";
import { UI, Ui, Window, WindowRenderer } from "app/apis/ui1";
import { createArtEditor } from "app/modules/arteditor/model";
import { createEngineContext as contextBlood } from "app/modules/blood/module";
import { createEngineContext as contextDuke } from "app/modules/duke/module";
import { createEngineContext as contextFury } from "app/modules/fury/module";
import { waitFor } from "app/modules/scheduler/ui/task-propgress";
import Optional from "optional-js";
import * as React from 'react';
import { createContext } from "react";
import { createGrpFs, createLocalFs, createRffFs, createZipFsFile } from "../fs";
import { OverwriteOption, confirmOverwrite } from "./overwrite";
import { FsManagerUiImpl } from "./view";

const GLOBAL = 'fs.global';
const LOCAL = 'fs.';

function getExtension(s: string) {
  const idx = s.lastIndexOf('.');
  return idx === -1 ? "" : s.substring(idx + 1).toUpperCase()
}

function RecentItem({ icon, label, }: { icon: string, label: string }) {
  return (<div className='row-block menu-item'>
    <div className={`fa-solid fa-fixwidth fa-${icon}`} />
    <div className='flex-fill text-ellipsis' style={{ maxWidth: 240 }}>{label}</div>
  </div>)
}

async function requestPermissions<T extends RecentResource>(res: T): Promise<T> {
  const permission = await res.handle.requestPermission();
  if (permission !== 'granted') throw new Error('');
  return res;
}

function recentAction(res: RecentResource, fs: FileSystems, activeFsName: Value<string>): Consumer<void> {
  switch (res.type) {
    case 'dir': return async () => { fs.mount(res.handle.name, createLocalFs((await requestPermissions(res)).handle)); activeFsName.set(res.handle.name) }
    case 'rff': return async () => { fs.mount(res.handle.name, await createRffFs(await (await requestPermissions(res)).handle.getFile())); activeFsName.set(res.handle.name) }
    case 'zip': return async () => { fs.mount(res.handle.name, await createZipFsFile(await (await requestPermissions(res)).handle.getFile())); activeFsName.set(res.handle.name) }
    case 'grp': return async () => { fs.mount(res.handle.name, await createGrpFs(await (await requestPermissions(res)).handle.getFile())); activeFsName.set(res.handle.name) }
  }
}

function recentItem(res: RecentResource, fs: FileSystems, activeFsName: Value<string>): ActionItem {
  const action = recentAction(res, fs, activeFsName);
  switch (res.type) {
    case 'dir': return { element: <RecentItem icon='folder-open' label={res.handle.name} />, action }
    case 'rff': return { element: <RecentItem icon='box' label={res.handle.name} />, action }
    case 'zip': return { element: <RecentItem icon='file-zipper' label={res.handle.name} />, action }
    case 'grp': return { element: <RecentItem icon='file-zipper' label={res.handle.name} />, action }
  }
}

export function fsIcon(type: string): string {
  switch (type) {
    case 'storage': return 'fa-database'
    case 'local': return 'fa-folder-open'
    case 'zip': return 'fa-file-zipper'
    case 'memory': return 'fa-memory'
    case 'rff': return 'fa-floppy-disk'
    case 'grp': return 'fa-floppy-disk'
    default: return 'fa-hard-drive'
  }
}

function createFsItem(fs: FileSystems, name: string, activeFsName: Value<string>): ActionItem {
  return {
    element: <div className='row-block menu-item'>
      <div className={`fa-solid fa-fixwidth ${fsIcon(fs.get(name).map(fs => fs.type()).orElse(''))}`} />
      {name}
    </div>,
    action: () => activeFsName.set(name),
    selected: activeFsName.get() === name
  }
}

async function addDirectory(fs: FileSystems, activeFsName: Value<string>, addRecent: Consumer<RecentResource>) {
  const handle = await window.showDirectoryPicker();
  const name = handle.name;
  fs.mount(name, createLocalFs(handle));
  activeFsName.set(name);
  addRecent({ type: 'dir', handle });
}

async function addZip(fs: FileSystems, activeFsName: Value<string>, addRecent: Consumer<RecentResource>) {
  try {
    const [handle] = await window.showOpenFilePicker({ types: [{ description: 'Zip File', accept: { 'application/zip': '.zip' } }] });
    const fileData = await handle.getFile();
    fs.mount(handle.name, await createZipFsFile(fileData));
    activeFsName.set(handle.name);
    addRecent({ type: 'zip', handle });
  } catch {

  }
}

async function addRff(fs: FileSystems, activeFsName: Value<string>, addRecent: Consumer<RecentResource>) {
  const [handle] = await window.showOpenFilePicker({ types: [{ description: 'Rff File', accept: { 'application/rff': '.rff' } }] });
  const fileData = await handle.getFile();
  fs.mount(handle.name, await createRffFs(fileData));
  activeFsName.set(handle.name);
  addRecent({ type: 'rff', handle });
}

async function addGrp(fs: FileSystems, activeFsName: Value<string>, addRecent: Consumer<RecentResource>) {
  const [handle] = await window.showOpenFilePicker({ types: [{ description: 'Grp File', accept: { 'application/grp': '.grp' } }] });
  const fileData = await handle.getFile();
  fs.mount(handle.name, await createGrpFs(fileData));
  activeFsName.set(handle.name);
  addRecent({ type: 'grp', handle });
}


export type GlobalFileSystemsManager = {
  newWindow(): Promise<WindowRenderer>;
}

export type FileInfo = { name: string, type: string, size: number }
export type FileProvider = { name: string, provider: Supplier<Promise<Optional<ArrayBuffer>>> }
type RecentDirectory = { type: "dir", handle: FileSystemDirectoryHandle }
type RecentZipFile = { type: "zip", handle: FileSystemFileHandle }
type RecentRffFile = { type: "rff", handle: FileSystemFileHandle }
type RecentGrpFile = { type: "grp", handle: FileSystemFileHandle }
type RecentResource = RecentDirectory | RecentRffFile | RecentZipFile | RecentGrpFile;

type GlobalSavedState = {
  recent: RecentResource[]
}

function createDefaultGlobalState(): GlobalSavedState {
  return { recent: [] }
}

async function createSavedState<T>(storage: Storage, id: string, def: T): Promise<Value<T>> {
  const saver = debounced(() => storage.set(id, state.get()), 1000);
  const loadedState = await storage.get<T>(id);
  const state = value(loadedState.map(s => applyDefaults(s, def)).orElse(def));
  state.subscribe(_ => saver());
  return state;
}

type FilesList = {
  fsName: string,
  files: string[]
}

type SavedState = {
  x: number | string,
  y: number | string,
  width: number,
  height: number,
  selectedFsName: string,
  sort: Sort,
}

function createDefaultSavedState(): SavedState {
  return {
    x: "center",
    y: "center",
    width: 600,
    height: 600,
    selectedFsName: "",
    sort: { column: undefined, direction: undefined }
  };
}

export const StateManagerContext = createContext<FileSystemsManagerImpl>(null);

class GlobalFileSystemsManagerImpl implements GlobalFileSystemsManager {
  readonly clipboard: Value<Optional<FilesList>> = value(Optional.empty());
  readonly fsNames: Source<string[]>;
  readonly recentResources: Source<RecentResource[]>;

  private counter = 0;

  constructor(
    private state: Value<GlobalSavedState>,
    readonly app: App,
    readonly fs: FileSystems,
    private storage: Storage,
    readonly ui: Ui,
    readonly actionDescriptors: ActionDescriptors,
    readonly injector: Injector,
  ) {
    this.fsNames = fs.list;
    this.recentResources = transformed(this.state, s => s.recent);
  }

  addRecent(res: RecentResource) {
    this.state.modImmer(s => s.recent = [res, ...s.recent.filter(r => r.handle.isSameEntry(res.handle)).slice(0, 4)])
  }

  async newWindow(): Promise<WindowRenderer> {
    const name = LOCAL + this.counter++;
    const savedState = await createSavedState(this.storage, name, createDefaultSavedState());
    const manager = new FileSystemsManagerImpl(savedState, this);
    return (onClose: Consumer<void>, windowConsumer: Consumer<Window>) =>
      <StateManagerContext.Provider value={manager}>
        <FsManagerUiImpl onClose={seq(onClose, () => manager.stop())} name={name} windowConsumer={windowConsumer} />
      </StateManagerContext.Provider>
  }
}

function createRecentDirs(fs: FileSystems, activeFsName: Value<string>, recent: RecentResource[]): ActionItem[] {
  return recent.length === 0 ? [] : [line('Recent'), ...recent.map(r => recentItem(r, fs, activeFsName))];
}

type ManagerActions = {
  addDir: Action,
  addZip: Action,
  addRff: Action,
  addGrp: Action,
  refresh: Action,
  copy: Action,
  paste: Action,
  delete: Action,
  createBlood: Action,
  createDuke: Action,
  createFury: Action,
}

class FileSystemsManagerImpl {
  readonly selectedFsName: Value<string>;
  readonly selectedFs: Source<Optional<FileSystem>>;
  readonly loadedFiles: Source<FileInfo[]>;
  readonly reloadFiles: Consumer<void>;
  readonly files: Source<FileInfo[]>;
  readonly sort: Value<Sort>;
  readonly storages: Source<ActionItem[]>
  readonly actions: ManagerActions;
  readonly selected = value<Set<FileInfo>>(new Set());
  readonly query = value('');

  private actionsChannel: ActionsNode;
  private disconnectors: Disconnector[] = [];

  constructor(
    readonly state: Value<SavedState>,
    private global: GlobalFileSystemsManagerImpl,
  ) {
    this.selectedFsName = this.createSelectedFsName();
    this.sort = this.createSort();
    this.selectedFs = this.createSelectedFs(this.selectedFsName);
    [this.loadedFiles, this.reloadFiles] = this.createLoadedFiles(this.selectedFs);
    this.files = this.createFiles(this.loadedFiles, this.sort, this.query);
    this.actions = this.createActions(global.actionDescriptors, res => global.addRecent(res), global.fs, this.selectedFsName);
    this.storages = this.createStorages(global.fsNames, global.recentResources, global.fs, this.selectedFsName,
      [this.actions.addDir, this.actions.addZip, this.actions.addRff, this.actions.addGrp]);
    this.selectedFsName.set(global.fs.get(state.get().selectedFsName).map(_ => state.get().selectedFsName).orElse(''));
  }

  stop() {
    this.disconnectors.forEach(d => d());
    this.disconnectors = [];
  }

  private createSelectedFsName(): Value<string> {
    const selectedFsName = value('');
    this.disconnectors.push(selectedFsName.subscribe(fs => this.state.modImmer(s => s.selectedFsName = fs)));
    return selectedFsName;
  }

  private createSort(): Value<Sort> {
    const sort = value(this.state.get().sort);
    this.disconnectors.push(sort.subscribe(sort => this.state.modImmer(s => s.sort = sort)));
    return sort;
  }

  private createLoadedFiles(selectedFs: Source<Optional<FileSystem>>): [Source<FileInfo[]>, Consumer<void>] {
    const loadFiles = async (fs: Optional<FileSystem>) => {
      this.selected.set(new Set());
      const files = await fs.map(async fs => fs.list()).orElse(Promise.resolve([]));
      return files.map(f => { return { name: f.name, size: f.size, type: getExtension(f.name) } })
    }
    const debouncedReload = debounced(() => loadedFiles.forceReload(), 100);
    const loadedFiles = transformedAsyncImmediate(selectedFs, [], loadFiles, (fs, files) => fs.map(fs => fs.subscribe((name, deleted) => debouncedReload())).orElse(nil()))
    return [loadedFiles, () => loadedFiles.forceReload()];
  }

  private createSelectedFs(selectedFsName: Source<string>): Source<Optional<FileSystem>> {
    return transformed(selectedFsName, name => this.global.fs.get(name));
  }

  private createFiles(files: Source<FileInfo[]>, sort: Source<Sort>, query: Source<string>): Source<FileInfo[]> {
    return transformed(tuple(files, sort, query), ([files, sort, query]) => {
      const queryLc = query.toLowerCase();
      const filtered = files.filter(f => f.name.toLowerCase().includes(queryLc));
      if (sort.column === undefined) return filtered;
      const [dirG, dirL] = sort.direction === 'ASC' ? [-1, 1] : [1, -1];
      return [...filtered.sort((l, r) => l[sort.column] < r[sort.column] ? dirG : dirL)];
    });
  }



  private createStorages(fsNames: Source<string[]>, recent: Source<RecentResource[]>, fs: FileSystems, activeFsName: Value<string>, addActions: Action[]): Source<ActionItem[]> {
    return transformed(tuple(recent, fsNames, activeFsName), ([recent, fsNames, _]) => [
      line('Connected'),
      ...fsNames.map(fsName => createFsItem(fs, fsName, activeFsName)),
      ...createRecentDirs(fs, activeFsName, recent),
      line('Add'),
      ...actionsToActionItem(addActions)
    ])
  }

  private createActions(actionDescriptors: ActionDescriptors, addRecent: Consumer<RecentResource>, fs: FileSystems, activeFsName: Value<string>): ManagerActions {
    const fsCtx = actionDescriptors.sub('fs');
    const nonEmptySelection = transformed(this.selected, s => s.size !== 0);
    const nonEmptyClipboard = transformed(this.global.clipboard, c => c.isPresent());
    const nonEmptyFs = transformed(this.selectedFs, fs => fs.isPresent());
    return {
      addDir: fsCtx.bindSync('add-dir', () => addDirectory(fs, activeFsName, addRecent)),
      addZip: fsCtx.bindSync('add-zip', () => addZip(fs, activeFsName, addRecent)),
      addRff: fsCtx.bindSync('add-rff', () => addRff(fs, activeFsName, addRecent)),
      addGrp: fsCtx.bindSync('add-grp', () => addGrp(fs, activeFsName, addRecent)),
      refresh: fsCtx.bindSync('refresh', () => this.reloadFiles()),
      delete: fsCtx.bindSync('delete', () => this.delete(), nonEmptySelection),
      copy: fsCtx.bindSync('copy', () => this.copy(), nonEmptySelection),
      paste: fsCtx.bindSync('paste', () => this.paste(), nonEmptyClipboard),
      createBlood: fsCtx.bindSync('create-engine-blood', () => this.createEngine(contextBlood), nonEmptyFs),
      createFury: fsCtx.bindSync('create-engine-fury', () => this.createEngine(contextFury), nonEmptyFs),
      createDuke: fsCtx.bindSync('create-engine-duke', () => this.createEngine(contextDuke), nonEmptyFs),
    }
  }

  setSize(width: number, height: number) {
    this.state.modImmer(s => { s.height = height; s.width = width });
  }

  setPosition(x: number, y: number) {
    this.state.modImmer(s => { s.x = x; s.y = y });
  }

  setChannel(actionsChannel: ActionsNode) {
    this.actionsChannel = actionsChannel;
  }

  private copy() {
    this.global.clipboard.set(Optional.of({
      fsName: this.selectedFsName.get(),
      files: iter(this.selected.get()).map(f => f.name).collect()
    }))
  }

  private async paste() {
    this.global.clipboard.get().ifPresent(({ fsName, files }) =>
      this.global.fs.get(fsName).ifPresent(srcFs =>
        this.writeFiles(files.map(f => { return { name: f, provider: () => srcFs.read(f) } }))))
  }

  private async delete() {
    const selected = this.selected.get();
    const isOk = await confirm(this.actionsChannel, this.global.ui, 'Delete', `Do you really want to delete the ${selected.size} selected files(s)?`);
    if (!isOk.orElse(false)) return;
    (await asyncFlatMapOptional(this.selectedFs.get(), fs => fs.writable())).ifPresent(async writable => {
      const scheduler = this.global.app.scheduler;
      const task = scheduler.exec(handle => handle.waitForParallel([...selected], f => writable.delete(f.name), f => `Deleting ${f.name}...`));
      await waitFor(this.actionsChannel, this.global.ui, "Delete", task);
    });
  }

  async writeFiles(files: FileProvider[]) {
    this.selectedFs.get().ifPresent(async fs => (await fs.writable()).ifPresent(async w => {
      let progressWindowChannel: ActionsNode = null;
      const scheduler = this.global.app.scheduler;
      const dp = 100 / (files.length + 1);
      const task = scheduler.exec(async handle => {
        const dstFiles = await handle.waitFor(fs.list(), 'Preparing...', dp);
        const filesMap = iter(dstFiles).toMap(f => f.name.toLowerCase(), identity());
        const checkFile = async (fn: string, data: ArrayBuffer): Promise<OverwriteOption> => {
          const dstFile = filesMap.get(fn.toLowerCase());
          if (!dstFile) return 'yes';
          const text = `Do you really want to overwrite file '${fn}'? Old size ${size(dstFile.size)} new size ${size(data.byteLength)}`;
          const isOk = await confirmOverwrite(progressWindowChannel, this.global.ui, 'Overwrite', text)
          return isOk.orElse('all-no');
        }
        const write = async (fn: string, data: ArrayBuffer) => await handle.waitFor(w.write(fn, data), `Writing ${fn}...`, dp);
        let overwriteAll = false;
        for (const file of files) {
          const dataOpt = await handle.waitFor(file.provider(), `Writing ${file.name}...`, 0);
          if (!dataOpt.isPresent()) continue;
          const data = dataOpt.get();
          if (!overwriteAll) {
            switch (await checkFile(file.name, data)) {
              case "all-no": return;
              case "no": continue;
              case "all-yes": overwriteAll = true; break;
              case "yes": break;
            }
          }
          await write(file.name, data);
        }
      });
      await waitFor(this.actionsChannel, this.global.ui, "Write", task, ch => progressWindowChannel = ch);
    }));
  }

  private async createEngine(contextFactory: Function<FileSystem, Promise<EngineContext<any>>>) {
    const fs = this.selectedFs.get().get();
    const task = this.global.app.scheduler.exec(async handle => {
      const engine = await handle.waitFor(contextFactory(fs), 'Creating Engine Context...', 30);
      const artEditor = await handle.waitFor(createArtEditor(this.global.injector, engine), 'Creating Art Editor...', 60);
      return await handle.waitFor(artEditor.newWindow(), 'Creating window...', 100);
    });
    const windowResult = await waitFor(this.actionsChannel, this.global.ui, 'Create Engine', task);
    if (windowResult.type === "done") {
      await this.global.ui.showWindow(windowResult.result);
    } else {
      this.global.app.logger.log('ERROR', windowResult.error);
      await info(this.actionsChannel, this.global.ui, 'Error', windowResult.error.message);
    }
  }
}

export const FileSystemsManagerModule = provider<GlobalFileSystemsManager>(async injector => {
  const [fs, actionDescriptors, app, ui] = await getInstances(injector, FS, ACTION_DESCRIPTORS, APP, UI);
  const windowStates = await app.storages('ui.window-states');
  const globalState = await createSavedState(windowStates, GLOBAL, createDefaultGlobalState());
  return new GlobalFileSystemsManagerImpl(globalState, app, fs, windowStates, ui, actionDescriptors, injector);
});

export const FS_MANAGER = new Dependency<GlobalFileSystemsManager>('File Systems Manager');