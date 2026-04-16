import { ActionItem, ActionList, createActionItem } from "@ui/action-list";
import { Button, Column, ProgressBar, Row, Tabs, useValue, useValuesContainer } from "@ui/commons";
import { info } from "@ui/message-box";
import { SizeType, WindowBuilder } from "@ui/windows-common";
import { GL_CONTEXT, GlContext } from "@utils/gl/drawstruct";
import { ACTION_DESCRIPTORS, ActionDescriptors } from "app/apis/actions";
import { APP, App } from "app/apis/app";
import { EngineContext, EngineContextFactory, NamedArtFile } from "app/apis/engine";
import { FileInfo, FileSystem, FileSystems, FS } from "app/apis/fs";
import { UI, Ui, Window } from "app/apis/ui";
import { VALUES, Values } from "app/apis/values";
import { createArtEditor } from "app/modules/arteditor/arteditor-model";
import { createBoardView } from "app/modules/board-view/board-view-model";
import { BoardRenderer3D, createRenderer3d } from "app/modules/board-view/boardRenderer3d";
import { createSavedState } from "app/modules/default/app/storage";
import { httpFs, stack } from "app/modules/fs/fs";
import { createEngineTexturesWork, EngineTextures } from "app/modules/gl/gl-context";
import Optional from "optional-js";
import React, { useRef } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Disposable, Source, Value, ValuesContainer, ValuesMap } from "ts-utils/callbacks";
import { getInstances, Injector } from "ts-utils/injector";
import { iter } from "ts-utils/iter";
import { sum } from "ts-utils/mathutils";
import { field } from "ts-utils/objects";
import { TaskController, TaskHandle, TaskValue } from "ts-utils/scheduler";
import { size } from "ts-utils/size";
import { first, nil, Ok, pair } from "ts-utils/types";
import { begin, Work } from "ts-utils/work";
import { EngineContextRecord, ENGINES } from "../engine-context-api";
import { createEngine } from "./create-engine-context";
import { ArtsInfoView } from "./tabs/art";
import { MapsInfoView } from "./tabs/maps";
import { getOrCreate } from "ts-utils/collections";

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
  name: Source<string>,
  arts: Source<number>,
  validArts: Source<number>,
  plus: Source<number>,
  shadowsteps: Source<number>,
  artFiles: Source<NamedArtFile[]>,
  mapFiles: Source<FileInfo[]>,
  kvxFiles: Source<FileInfo[]>,
  ctx: EngineContext;
  textures: EngineTextures;
  rendererProvider: Work<[], Source<BoardRenderer3D>>,
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
    private ui: Ui,
    private actionDescriptors: ActionDescriptors,
    private fs: FileSystems,
    private app: App,
    private values: Values,
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
    this.localValues.addSubscribed(this.currentEngineId, id => this.currentEngineRecord.set(Optional.of(this.engines.get()[id])));
  }


  openRecord(rec: EngineContextRecord) {
    return getOrCreate(this.ctxCache, rec, rec => {
      const createEngine = iter(ENGINES)
        .first(e => e.id === rec.type)
        .map(field('factory'))
        .orElseThrow(() => new Error(`Unknown engine type: '${rec.type}' `));
      const work = begin()
        .thenWork(handle =>
          this.localValues.createChild(`engine-${rec.name}`).initializeAsync(values => begin()
            .forkItems(rec.fileSystems, f => `Opening File System...`, f => this.fs.deserialize(f).open())
            .then('Building FS Stack...', async fss => values.value('fs-stack', iter([...fss, new Ok(httpFs(''))]).map(r => r.unwrap()).reduceFirst(stack).get()))
            .thenWork((handle, fs) => createEngine(handle, fs, values, rec.mods))
            .thenWorkPass((handle, engine) => createEngineTexturesWork(handle, engine, this.glCtx, values))
            .then<EngineInfo>('Constructing Engine Info...', async (engine, textures) => {
              const name = engine.name;
              const artFiles = engine.art;
              const shadowsteps = engine.shadowsteps;
              const resources = engine.resources;
              const arts = values.transformed(`arts`, artFiles, a => iter(a).map(a => a.art.arts.length).reduceFirst(sum).orElse(0));
              const validArts = values.transformed(`validArts`, artFiles, a => iter(a).map(a => a.art.arts).flatten().filter(a => a.h !== 0 && a.w !== 0).length())
              const plus = values.transformed(`plus`, engine.plus, p => p.length);
              const mapsLoader = async (res: FileSystem) => res.list().then(l => iter(l).filter(i => i.name.toLowerCase().endsWith('.map')).collect());
              const mapFiles = await values.transformedAsync(`maps`,
                resources,
                mapsLoader,
                nil(),
                (fs, maps) => fs.subscribe((name, deleted) => { if (name.toLowerCase().endsWith('.map')) maps.setPromiseOrDispose(m => mapsLoader(fs)) }));
              const kvxLoader = async (res: FileSystem) => res.list().then(l => iter(l).filter(i => i.name.toLowerCase().endsWith('.kvx')).collect());
              const kvxFiles = await values.transformedAsync(`kvx`,
                resources,
                kvxLoader,
                nil(),
                (fs, maps) => fs.subscribe((name, deleted) => maps.setPromiseOrDispose(m => kvxLoader(fs))));

              let renderer: Source<BoardRenderer3D> | undefined = undefined;
              const rendererProvider = async (handle: TaskHandle) => {
                if (renderer !== undefined) return renderer;
                renderer = first(await createRenderer3d(values, this.glCtx, engine, textures)(handle));
                return renderer;
              };

              const dispose = async () => { engine.dispose(); values.dispose(); textures.dispose(); }
              return { name, arts, validArts, plus, shadowsteps, artFiles, mapFiles, kvxFiles, ctx: engine, textures, rendererProvider, dispose }
            }).finish()(handle)))
        .finishUntuple();
      return this.app.scheduler.exec(work);
    })
  }

  async addEngine() {
    const engineRecord = await createEngine(this.ui, this.actionDescriptors, this.fs, this.app, this.values);
    engineRecord.ifPresent(e => this.engines.modImmer(p => p.push(e)));
  }

  async editEngine() {
    const id = this.currentEngineId.get();
    const rec = this.engines.get()[id];
    const editedRec = await createEngine(this.ui, this.actionDescriptors, this.fs, this.app, this.values, rec);
    editedRec.ifPresent(rec => this.engines.modImmer(es => es[id] = rec));
  }

  private createEngineItems(name: string): Source<ActionItem[]> {
    return this.localValues.transformedTuple(name, [this.engines, this.currentEngineId], ([es, selected]) => iter(es)
      .enumerate()
      .map(([e, idx]) => createActionItem(<div>{e.name} - {e.type}</div>, () => this.currentEngineId.set(idx), false, idx === selected))
      .collect())
  }

  async openMap(engine: EngineContext, textures: EngineTextures, rendererProvider: Work<[], Source<BoardRenderer3D>>, mapName: string): Promise<void> {
    (await createBoardView(this.injector, engine, textures, rendererProvider, mapName))
      .onErr(e => { this.app.logger.log('ERROR', e); info(this.ui, this.actionDescriptors, this.values, 'Error', e.message) })
      .onOk(w => this.ui.addWindow(w));
  }

  async openArtEditor(ctx: EngineContext): Promise<void> {
    this.ui.addWindow(await createArtEditor(this.injector, ctx));
  }
}

function EngineInfoView({ info }: { info: EngineInfo }) {
  const plus = useValue(info.plus);
  const shadowsteps = useValue(info.shadowsteps);
  const name = useValue(info.name);

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

function KvxFile(props: { info: FileInfo }) {
  return <Row>
    <div className='flex-fill'>{props.info.name}</div>
    <div className='flex-auto'>{size(props.info.size)}</div>
  </Row>
}

function VoxelsInfoView({ info, selectedVoxelIdxValue, editor }: { info: EngineInfo, selectedVoxelIdxValue: Value<number>, editor: Editor }) {
  const values = useValuesContainer(`${ID}-voxels`);
  const selectedVoxelIdx = useValue(selectedVoxelIdxValue);
  const voxelCountValue = values.transformed('voxelsCount', info.kvxFiles, mf => mf.length);
  const voxelsCount = useValue(voxelCountValue);
  const voxelFilesValue = values.transformed('voxelFiles', info.kvxFiles, mf => iter(mf)
    .enumerate().map(([info, idx]) => createActionItem(<KvxFile info={info} />, () => selectedVoxelIdxValue.set(idx), false, idx === selectedVoxelIdx)).collect());
  const voxelFiles = useValue(voxelFilesValue);
  const canvasContRef = useRef<HTMLDivElement>(null);

  return <Column className='form-panel'>
    <div ref={canvasContRef} />
    <Column className='form-panel-rows-container'>
      <Row className='form-row'>
        <div className='form-row-label'>Maps</div>
        <div className='form-row-content'>{voxelsCount}</div>
      </Row>
      <Row className='form-row'>
        <div className='form-row-label'>Files</div>
        <Row className='form-row-content'>
        </Row>
      </Row>
      <Row className='form-row fill'>
        <div className='form-row-label' />
        <Column className='form-row-content flex-fill'>
          <Column className='flex-fill' style={{ overflow: 'auto' }}>
            <ActionList items={voxelFiles} stripped={true} className='action-list-bg flex-fill' />
          </Column>
        </Column>
      </Row>
    </Column>
  </Column>
}


function EngineContextResult({ editor, result, rec }: { editor: Editor, result: Source<TaskValue<EngineInfo>>, rec: EngineContextRecord }) {
  const res = useValue(result);
  const values = useValuesContainer(`${ID}-view`);
  const selectedVoxelIdValue = values.value('selectedVoxelId', -1);
  const active = values.value('active', 0);

  return !res.isDone()
    ? <Row className="flex-auto"><ProgressBar progress={res.progress().progress} info={res.progress().info} /></Row>
    : res.result().isErr()
      ? <div className="error">{res.result().getErr().message}</div>
      : <Tabs items={[
        { icon: 'bars', label: 'General', content: <EngineInfoView info={res.result().getOk()} /> },
        { icon: 'images', label: 'Arts', content: <ArtsInfoView info={res.result().getOk()} editor={editor} /> },
        { icon: 'map', label: 'Maps', content: <MapsInfoView info={res.result().getOk()} editor={editor} /> },
        { icon: '', label: 'Voxels', content: <VoxelsInfoView info={res.result().getOk()} selectedVoxelIdxValue={selectedVoxelIdValue} editor={editor} /> },
      ]} active={active} />
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

  const [actionDescriptors, app, ui, fs, glCtx, values] = await getInstances(injector, ACTION_DESCRIPTORS, APP, UI, FS, GL_CONTEXT, VALUES);
  const localValues = values.create(ID);
  const windowStates = await app.storages('ui.window-states');
  const state = await createSavedState(localValues, windowStates, ID, createDefaultState(), app.timer);
  const editor = new Editor(localValues, state, ui, actionDescriptors, fs, app, values, glCtx, injector);

  globalWindow = new WindowBuilder(ID, actionDescriptors, localValues)
    .titleFromId()
    .minSize(400, 400)
    .state(state)
    .actions(Object.values(editor.actions))
    .disposable(localValues)
    .onClose(() => globalWindow = undefined)
    .build(<EngineContextEditorUiImpl editor={editor} />)
  return globalWindow;
}