import { ActionItem, ActionList, createActionItem } from "@ui/action-list";
import { Button, Column, ProgressBar, Row, Tabs, useValue, useValuesContainer } from "@ui/commons";
import { SizeType } from "@ui/windows-common";
import { GL_CONTEXT, GlContext } from "@utils/gl/drawstruct";
import { EngineContext, EngineContextFactory } from "app/apis/engine";
import { FileInfo, FileSystem, FileSystems, FS } from "app/apis/fs";
import { UI_UTILS, UiUtils, Window } from "app/apis/ui";
import { createArtEditor } from "app/modules/arteditor/arteditor-model";
import { createBoardView } from "app/modules/board-view/board-view-model";
import { BoardRenderer3D, createRenderer3d } from "app/modules/board-view/boardRenderer3d";
import { createSavedState } from "app/modules/default/app/storage";
import { httpFs, stack } from "app/modules/fs/fs";
import { createEngineTexturesWork, EngineTextures } from "app/modules/gl/gl-context";
import { createKvxView } from "app/modules/kvx/kvx-editor";
import { createTextEditor } from "app/modules/text-editor/text-editor";
import Optional from "optional-js";
import React from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Disposable, Source, Value, ValuesContainer, ValuesMap } from "ts-utils/callbacks";
import { getOrCreate } from "ts-utils/collections";
import { cookbook, cookbookImmediate } from "ts-utils/cookbook";
import { getInstances, Injector } from "ts-utils/injector";
import { iter } from "ts-utils/iter";
import { sum } from "ts-utils/mathutils";
import { field } from "ts-utils/objects";
import { Task, TaskController, TaskHandle, TaskValue } from "ts-utils/scheduler";
import { nil, Ok, pair } from "ts-utils/types";
import { EngineContextRecord, getEngine } from "../engine-context-api";
import { createEngine } from "./create-engine-context";
import { ArtsInfoView } from "./tabs/art";
import { FilesInfoView } from "./tabs/files";
import { MapsInfoView } from "./tabs/maps";
import { SoundsInfoView } from "./tabs/sounds";

const ID = 'engines-context';

export type Engines = {
  readonly engines: Source<EngineContext>;
  readonly factories: Map<string, EngineContextFactory>;
}

type SavedState = {
  size: SizeType
  position: SizeType,
  engines: EngineContextRecord[],
}

export type EngineInfo = {
  arts: Source<number>,
  validArts: Source<number>,
  plus: Source<number>,
  files: Source<FileInfo[]>,
  filesMap: Source<Map<string, FileInfo>>,
  ctx: EngineContext;
  textures: EngineTextures;
  rendererProvider: Task<Source<BoardRenderer3D>>,
} & Disposable;

function createDefaultState(): SavedState {
  return {
    size: [800, 800],
    position: ['center', 'center'],
    engines: [],
  };
}

type EngineContextEditorActions = {}

export class Editor {
  readonly engines: Value<EngineContextRecord[]>;
  readonly error: Value<Optional<Error>>;
  readonly engineItems: Source<ActionItem[]>;
  readonly currentEngineId: Value<number>;
  readonly currentEngineRecord: Value<Optional<EngineContextRecord>>;
  readonly currentEngine: Value<Optional<TaskController<EngineInfo>>>;
  readonly actions: EngineContextEditorActions;

  private ctxCache = new Map<EngineContextRecord, TaskController<EngineInfo>>();

  constructor(
    private localValues: ValuesContainer,
    private savedState: ValuesMap<SavedState>,
    private fs: FileSystems,
    readonly uiUtils: UiUtils,
    private glCtx: GlContext,
    private injector: Injector,
  ) {
    this.engines = savedState.get('engines');
    this.currentEngineId = localValues.value('selectedEngineId', -1);
    this.currentEngineRecord = this.localValues.transformedTuple('engine-rec', [this.engines, this.currentEngineId], ([engines, id]) => Optional.ofNullable(engines[id]));
    this.currentEngine = this.localValues.transformed('engine', this.currentEngineRecord, rec => rec.map(r => this.openRecord(r)));
    this.error = this.localValues.value('error', Optional.empty());
    this.engineItems = this.createEngineItems('engineItems');
    this.actions = {};
  }


  openRecord(rec: EngineContextRecord): TaskController<EngineInfo> {
    return getOrCreate(this.ctxCache, rec, rec => {
      const createEngine = getEngine(rec.type).map(field('factory')).orElseThrow(() => new Error(`Unknown engine type: '${rec.type}' `));
      const task: Task<EngineInfo> = handle =>
        this.localValues.createChild(`engine-${rec.name}`).initializeAsync(values =>
          cookbookImmediate(handle, book => {
            const fss = rec.fileSystems.map(f => book.recepie(`Opening File System...`, [], async () => this.fs.deserialize(f).open()));
            const fsStack = book.recepie('Building FS Stack...', fss, async (...fss) => values.value('fs-stack', iter([...fss, new Ok(httpFs(''))]).map(r => r.unwrap()).reduceFirst(stack).get()));
            const engine = book.paste([fsStack], async (handle, fs) => createEngine(handle, fs, values, rec.mods));
            const textures = book.paste([engine], async (handle, engine) => createEngineTexturesWork(handle, engine, this.glCtx, values));
            return book.recepie('Constructing Engine Info...', [engine, textures], async (engine, textures) => {
              const arts = values.transformed(`arts`, engine.art, a => iter(a).map(a => a.art.arts.length).reduceFirst(sum).orElse(0));
              const validArts = values.transformed(`validArts`, engine.art, a => iter(a).map(a => a.art.arts).flatten().filter(a => a.h !== 0 && a.w !== 0).length())
              const plus = values.transformed(`plus`, engine.plus, p => p.length);
              const filesLoader = async (res: FileSystem) => res.list();
              const files = await values.transformedAsync('files', engine.resources, filesLoader, nil(), (fs, files) => fs.subscribe(() => files.setPromiseOrDispose(f => filesLoader(fs))));
              const filesMap = values.transformed('files-map', files, files => iter(files).toMap(f => f.name.toLowerCase(), f => f));

              let renderer: Source<BoardRenderer3D> | undefined = undefined;
              const rendererProvider = async (handle: TaskHandle) => {
                if (renderer !== undefined) return renderer;
                renderer = await createRenderer3d(values, this.glCtx, engine, textures)(handle);
                return renderer;
              };

              const dispose = async () => { engine.dispose(); values.dispose(); textures.dispose(); }
              return { arts, validArts, plus, files, filesMap, ctx: engine, textures, rendererProvider, dispose }
            });
          }));
      return this.uiUtils.app.scheduler.exec(task);
    })
  }

  async addEngine() {
    const engineRecord = await createEngine(this.uiUtils, this.fs);
    engineRecord.ifPresent(e => this.engines.modImmer(p => p.push(e)));
  }

  async editEngine() {
    const id = this.currentEngineId.get();
    const rec = this.engines.get()[id];
    const editedRec = await createEngine(this.uiUtils, this.fs, rec);
    editedRec.ifPresent(rec => this.engines.modImmer(es => es[id] = rec));
  }

  async deleteEngine() {
    const id = this.currentEngineId.get();
    this.currentEngineId.set(-1);
    this.engines.mod(es => es.toSpliced(id, 1));
  }

  private createEngineItems(name: string): Source<ActionItem[]> {
    return this.localValues.transformedTuple(name, [this.engines, this.currentEngineId], ([es, selected]) => iter(es)
      .enumerate()
      .map(([e, idx]) => createActionItem(<div>{e.name} - {e.type}</div>, () => this.currentEngineId.set(idx), false, idx === selected))
      .collect())
  }

  async openMap(engine: EngineContext, textures: EngineTextures, rendererProvider: Task<Source<BoardRenderer3D>>, mapName: string): Promise<void> {
    createBoardView(this.injector, engine, textures, rendererProvider, mapName);
  }

  async openText(text: string): Promise<void> {
    createTextEditor(this.injector, text);
  }

  async openKvx(engine: EngineContext, rendererProvider: Task<Source<BoardRenderer3D>>, fn: string): Promise<void> {
    createKvxView(this.injector, engine, rendererProvider, fn);
  }

  async openFile(engine: EngineContext, rendererProvider: Task<Source<BoardRenderer3D>>, fileName: string): Promise<void> {
    const fn = fileName.toLowerCase();
    if (fn.endsWith('.con') || fn.endsWith('.txt') || fn.endsWith('.def') || fn.endsWith('.json')) {
      const fileOpt = await engine.resources.get().read(fileName);
      if (!fileOpt.isPresent()) return;
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(fileOpt.get());
      this.openText(text);
    } else if (fn.endsWith('.kvx')) {
      this.openKvx(engine, rendererProvider, fn);
    }
  }

  async openArtEditor(ctx: EngineContext): Promise<void> {
    createArtEditor(this.injector, ctx);
  }
}

function EngineInfoView({ info }: { info: EngineInfo }) {
  const plus = useValue(info.plus);
  const shadowsteps = useValue(info.ctx.shadowsteps);
  const name = useValue(info.ctx.name);

  return <Column className='form-panel'>
    <Column className='form-panel-rows-container'>
      <Row className='form-row'>
        <div className='form-row-label'>Name</div>
        <div className='form-row-content'>{name}</div>
      </Row>
      <Row className='form-row'>
        <div className='form-row-label'>Palette Lookups</div>
        <div className='form-row-content'>{plus}</div>
      </Row>
      <Row className='form-row'>
        <div className='form-row-label'>Shadosteps</div>
        <div className='form-row-content'>{shadowsteps}</div>
      </Row>
    </Column>
  </Column>
}

function EngineContextResult({ editor, result, rec }: { editor: Editor, result: Source<TaskValue<EngineInfo>>, rec: EngineContextRecord }) {
  const res = useValue(result);
  const values = useValuesContainer(`${ID}-view`);
  const active = values.value('active', 0);

  return res.on(r => r.on(
    ok => <Tabs items={[
      { icon: 'bars', label: 'General', content: <EngineInfoView info={ok} /> },
      { icon: 'file', label: 'Files', content: <FilesInfoView info={ok} editor={editor} /> },
      { icon: 'images', label: 'Arts', content: <ArtsInfoView info={ok} editor={editor} /> },
      { icon: 'map', label: 'Maps', content: <MapsInfoView info={ok} editor={editor} /> },
      { icon: 'music', label: 'Sounds', content: <SoundsInfoView info={ok} scheduler={editor.uiUtils.app.scheduler} /> },
    ]} active={active} />,
    err => <div className="error">{err.message}</div>),
    p => <Row className="flex-auto"><ProgressBar progress={p.progress} info={p.info} /></Row>)
}

function EngineContextView({ editor }: { editor: Editor }) {
  const rec = useValue(editor.currentEngineRecord);
  const engine = useValue(editor.currentEngine);
  const recEngine = rec.flatMap(r => engine.map(e => pair(r, e)));

  return <Column className='flex-fill'>
    {recEngine.map(([rec, ctl]) => <EngineContextResult editor={editor} result={ctl.task} rec={rec} />).orElse(<></>)}
  </Column>
}

function EngineContextEditorUiImpl({ editor }: { editor: Editor }) {
  const engineItems = useValue(editor.engineItems);

  return <Column>
    <Row className='window-toolbar flex-auto'>
      <Button className='flex-auto' onClick={_ => editor.addEngine()}>Add Engine...</Button>
      <Button className='flex-auto' onClick={_ => editor.editEngine()}>Edit Engine...</Button>
      <Button className='flex-auto' onClick={_ => editor.deleteEngine()}>Delete Engine...</Button>
    </Row>
    <PanelGroup direction={"horizontal"} className="flex-fill padded-5 box-sized">
      <Panel className="column-block" defaultSize={30} minSize={10}>
        <Column>
          <ActionList className='flex-fill action-list-bg' items={engineItems} stripped={true} />
        </Column>
      </Panel>
      <PanelResizeHandle className="hspacer" />
      <Panel className="column-block" defaultSize={70} minSize={10}>
        <EngineContextView editor={editor} />
      </Panel>
    </PanelGroup>
  </Column>
}

let globalWindow: Window | undefined;
export async function createEngines(injector: Injector): Promise<Window> {
  if (globalWindow !== undefined) return globalWindow;

  const [fs, glCtx, uiUtils] = await getInstances(injector, FS, GL_CONTEXT, UI_UTILS);
  const localValues = uiUtils.values.create(ID);
  const windowStates = await uiUtils.app.storages('ui.window-states');
  const state = await createSavedState(localValues, windowStates, ID, createDefaultState(), uiUtils.app.timer);
  const editor = new Editor(localValues, state, fs, uiUtils, glCtx, injector);

  globalWindow = uiUtils.windowBuilder(ID, localValues)
    .titleFromId()
    .minSize(400, 400)
    .state(state)
    .actions(Object.values(editor.actions))
    .disposable(localValues)
    .onClose(() => globalWindow = undefined)
    .build(<EngineContextEditorUiImpl editor={editor} />)
  return globalWindow;
}