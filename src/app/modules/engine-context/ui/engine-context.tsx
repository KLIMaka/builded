import { ActionItem, ActionList, createActionItem } from "@ui/action-list";
import { ActionButton, ActionDescriptorsContext, Button, Column, Row, Tabs, useValue, useValuesContainer } from "@ui/commons";
import { SizeType, WindowBuilder } from "@ui/windows-common";
import { createContainer, Disposable, Source, Value, ValuesContainer, ValuesMap } from "@utils/callbacks";
import { getInstances, Injector } from "@utils/injector";
import { iter } from "@utils/iter";
import { sum } from "@utils/mathutils";
import { size } from "@utils/size";
import { nil, Result } from "@utils/types";
import { ACTION_DESCRIPTORS, ActionDescriptors } from "app/apis/actions";
import { App, APP, ProgressInfo, TaskController, TaskValue } from "app/apis/app1";
import { EngineContext, EngineContextFactory, NamedArtFile } from "app/apis/engine";
import { FileInfo, FileSystem, FileSystems, FS } from "app/apis/fs";
import { UI, Ui, Window } from "app/apis/ui1";
import { createArtEditor } from "app/modules/arteditor/arteditor-model";
import { createBoardView } from "app/modules/board-view/ui/board-view-model";
import { createSavedState } from "app/modules/default/app/storage";
import { stack } from "app/modules/fs/fs";
import { BuildGlEngineContext } from "app/modules/gl/buildgl";
import { GL_CONTEXT, GlContext } from "app/modules/gl/gl-context";
import { begin } from "app/modules/scheduler/work";
import Optional from "optional-js";
import React, { useContext, useRef } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { EngineContextRecord, ENGINES } from "../engine-context-api";
import { createEngine } from "./create-engine-context";

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

type EngineInfo = {
  name: Source<string>,
  arts: Source<number>,
  validArts: Source<number>,
  plus: Source<number>,
  shadowsteps: Source<number>,
  artFiles: Source<NamedArtFile[]>,
  mapFiles: Source<FileInfo[]>,
  kvxFiles: Source<FileInfo[]>,
  ctx: EngineContext;
  bglctx: BuildGlEngineContext,
} & Disposable;

function createDefaultState(): SavedState {
  return {
    size: [600, 600],
    position: ['center', 'center'],
    engines: [],
  };
}

type EngineContextEditorActions = {}

class Editor {
  readonly engines: Value<EngineContextRecord[]>;
  readonly error: Value<Optional<Error>>;
  readonly engineItems: Source<ActionItem[]>;
  readonly currentEngineId: Value<number>;
  readonly currentEngine: Value<Optional<TaskController<EngineInfo>>>;
  readonly actions: EngineContextEditorActions;

  private engineContextsCache = new Map<number, Source<Optional<Result<EngineInfo>>>>();

  constructor(
    private values: ValuesContainer,
    private savedState: ValuesMap<SavedState>,
    private ui: Ui,
    private actionDescriptors: ActionDescriptors,
    private fs: FileSystems,
    private app: App,
    private glCtx: GlContext,
    private injector: Injector,
  ) {
    this.engines = savedState.get('engines');
    this.currentEngine = this.values.valueBuilder({ name: 'engine', value: Optional.empty(), disposer: ctr => ctr.map(ctr => ctr.end().then(r => r.onOk(info => info.dispose()))) });
    this.error = this.values.value('error', Optional.empty());
    this.currentEngineId = values.value('selectedEngineId', -1);
    this.engineItems = this.createEngineItems('engineItems');
    this.actions = {};
    this.values.addSubscribed(this.currentEngineId, v => v.subscribe(id => this.onIdChange(id)));
  }

  async onIdChange(idx: number) {
    const rec = this.engines.get()[idx];
    const createEngine = iter(ENGINES).first(e => e.id === rec.type).map(e => e.factory).orElseThrow(() => new Error(`Unknown engine type: '${rec.type}' `));
    const work = begin()
      .thenWork(handle =>
        createContainer(`Engine-${rec.name}`).initializeAsync(values => begin()
          .forkItems(rec.fileSystems, f => `Opening File System...`, f => this.fs.deserialize(f).open())
          .then('Building FS Stack...', async fss => values.value('', iter(fss).map(r => r.unwrap()).reduceFirst(stack).get()))
          .thenWork((handle, fs) => createEngine(handle, fs, rec.mods))
          .then<EngineInfo>('Constructing Engine Info...', async ctx => {
            const bglctx = new BuildGlEngineContext(ctx, this.glCtx);
            const name = ctx.name;
            const artFiles = ctx.art;
            const shadowsteps = ctx.shadowsteps;
            const resources = ctx.resources;
            const arts = values.transformed(`arts_${idx}`, artFiles, a => iter(a).map(a => a.art.arts.length).reduceFirst(sum).orElse(0));
            const validArts = values.transformed(`validArts_${idx}`, artFiles, a => iter(a).map(a => a.art.arts).flatten().filter(a => a.h !== 0 && a.w !== 0).length())
            const plus = values.transformed(`plus_${idx}`, ctx.plus, p => p.length);
            const mapsLoader = async (res: FileSystem) => res.list().then(l => iter(l).filter(i => i.name.toLowerCase().endsWith('.map')).collect());
            const mapFiles = values.transformedAsyncImmediate(`maps_${idx}`,
              resources,
              [] as FileInfo[],
              mapsLoader,
              (fs, maps) => fs.subscribe((name, deleted) => { if (name.toLowerCase().endsWith('.map')) maps.setPromise(m => mapsLoader(fs)) }));
            const kvxLoader = async (res: FileSystem) => res.list().then(l => iter(l).filter(i => i.name.toLowerCase().endsWith('.kvx')).collect());
            const kvxFiles = values.transformedAsyncImmediate(`kvx_${idx}`,
              resources,
              [] as FileInfo[],
              kvxLoader,
              (fs, maps) => fs.subscribe((name, deleted) => maps.setPromise(m => kvxLoader(fs))));
            const dispose = async () => { ctx.dispose(); values.dispose(); }
            return { name, arts, validArts, plus, shadowsteps, artFiles, mapFiles, kvxFiles, ctx, bglctx, dispose }
          }).finish()(handle)))
      .finishUntuple();

    const task = this.app.scheduler.exec(work);
    this.currentEngine.set(Optional.of(task));
  }

  async addEngine() {
    const engineRecord = await createEngine(this.ui, this.actionDescriptors, this.fs, this.app);
    engineRecord.ifPresent(e => this.engines.modImmer(p => p.push(e)));
  }

  async editEngine() {
    const id = this.currentEngineId.get();
    const rec = this.engines.get()[id];
    const editedRec = await createEngine(this.ui, this.actionDescriptors, this.fs, this.app, rec);
    editedRec.ifPresent(rec => this.engines.modImmer(es => es[id] = rec));
  }

  private createEngineItems(name: string): Source<ActionItem[]> {
    return this.values.transformedTuple(name, [this.engines, this.currentEngineId], ([es, selected]) => iter(es)
      .enumerate()
      .map(([e, idx]) => createActionItem(<div>{e.name} - {e.type}</div>, () => this.currentEngineId.set(idx), false, idx === selected))
      .collect())
  }

  async openMap(ctx: BuildGlEngineContext, mapName: string): Promise<void> {
    const window = await createBoardView(this.injector, ctx, mapName);
    this.ui.addWindow(window);
  }

  async openArtEditor(ctx: BuildGlEngineContext): Promise<void> {
    const window = await createArtEditor(this.injector, ctx);
    this.ui.addWindow(window);
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

function ArtFile(props: { artFile: NamedArtFile }) {
  return <Row>
    <div className='flex-fill'>{props.artFile.name}</div>
    <div className='flex-auto'>{props.artFile.art.header.start}-{props.artFile.art.header.end}</div>
  </Row>
}

function ArtsInfoView({ info, editor }: { info: EngineInfo, editor: Editor }) {
  const values = useValuesContainer(`${ID}-arts`);
  const artFilesCountValue = values.transformed('artFilesCount', info.artFiles, afs => afs.length);
  const artFilesCount = useValue(artFilesCountValue);
  const arts = useValue(info.arts);
  const validArts = useValue(info.validArts);
  const artFilesValue = values.transformed('artFiles', info.artFiles, files => iter(files).map(f => createActionItem(<ArtFile artFile={f} />, nil())).collect());
  const artFiles = useValue(artFilesValue);
  const actionDescriptors = useContext(ActionDescriptorsContext);
  const ctx = actionDescriptors.sub(ID);
  const artEditorAction = ctx.bind('art-editor', () => editor.openArtEditor(info.bglctx));

  return <Column className='form-panel'>
    <Column className='form-panel-rows-container'>
      <Row className='form-row'>
        <div className='form-row-label'>Art Files</div>
        <div className='form-row-content'>{artFilesCount}</div>
      </Row>
      <Row className='form-row'>
        <div className='form-row-label'>Arts</div>
        <div className='form-row-content'>{arts} / {validArts}</div>
      </Row>
      <Row className='form-row'>
        <div className='form-row-label'>Files</div>
        <Row className='form-row-content'>
          <ActionButton action={artEditorAction} />
        </Row>
      </Row>
      <Row className='form-row fill'>
        <div className='form-row-label' />
        <Column className='form-row-content flex-fill'>
          <Column className='flex-fill' style={{ overflow: 'auto' }}>
            <ActionList items={artFiles} stripped={true} className='action-list-bg flex-fill' />
          </Column>
        </Column>
      </Row>
    </Column>
  </Column>
}

function MapFile(props: { info: FileInfo }) {
  return <Row>
    <div className='flex-fill'>{props.info.name}</div>
    <div className='flex-auto'>{size(props.info.size)}</div>
  </Row>
}

function MapsInfoView({ info, selectedMapIdxValue, editor }: { info: EngineInfo, selectedMapIdxValue: Value<number>, editor: Editor }) {
  const values = useValuesContainer(`${ID}-maps`);
  const selectedMapIdx = useValue(selectedMapIdxValue);
  const mapCountValue = values.transformed('mapCount', info.mapFiles, mf => mf.length);
  const mapsCount = useValue(mapCountValue);
  const mapFilesValue = values.transformed('mapFiles', info.mapFiles, mf => iter(mf)
    .enumerate().map(([info, idx]) => createActionItem(<MapFile info={info} />, () => selectedMapIdxValue.set(idx), false, idx === selectedMapIdx)).collect());
  const mapFiles = useValue(mapFilesValue);
  const actionDescriptors = useContext(ActionDescriptorsContext);
  const ctx = actionDescriptors.sub(ID);
  const openMapEnabled = values.transformedTuple('openMapEnabled', [selectedMapIdxValue, mapCountValue], ([selected, count]) => selected >= 0 && selected < count);
  const openMapActionImpl = values.transformedTuple('openMapAction', [selectedMapIdxValue, info.mapFiles], ([selected, mapFiles]) => () => editor.openMap(info.bglctx, mapFiles[selected].name))
  const openMapAction = ctx.bind('open-map', async () => openMapActionImpl.get()(), openMapEnabled);

  return <Column className='form-panel'>
    <Column className='form-panel-rows-container'>
      <Row className='form-row'>
        <div className='form-row-label'>Maps</div>
        <div className='form-row-content'>{mapsCount}</div>
      </Row>
      <Row className='form-row'>
        <div className='form-row-label'>Files</div>
        <Row className='form-row-content'>
          <ActionButton action={openMapAction} />
        </Row>
      </Row>
      <Row className='form-row fill'>
        <div className='form-row-label' />
        <Column className='form-row-content flex-fill'>
          <Column className='flex-fill' style={{ overflow: 'auto' }}>
            <ActionList items={mapFiles} stripped={true} className='action-list-bg flex-fill' />
          </Column>
        </Column>
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
  const canvasContRef = useRef<HTMLDivElement>();

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

function Progress({ progress }: { progress: ProgressInfo }) {
  const info = useValue(progress.info);
  const p = useValue(progress.progress);
  return <><div>{info}</div> <div><progress value={p} max='100'></progress></div></>
}

function EngineContextResult({ editor, result }: { editor: Editor, result: Source<TaskValue<EngineInfo>> }) {
  const res = useValue(result);
  const values = useValuesContainer(`${ID}-view`);
  const selectedMapIdValue = values.value('selectedMapId', -1);
  const selectedVoxelIdValue = values.value('selectedVoxelId', -1);
  const active = values.value('active', 0);

  return !res.isDone()
    ? <Progress progress={res.progress()} />
    : res.result().isErr()
      ? <div className="error">{res.result().getErr().message}</div>
      : <Tabs items={[
        { icon: 'bars', label: 'General', content: <EngineInfoView info={res.result().getOk()} /> },
        { icon: 'images', label: 'Arts', content: <ArtsInfoView info={res.result().getOk()} editor={editor} /> },
        { icon: 'map', label: 'Maps', content: <MapsInfoView info={res.result().getOk()} selectedMapIdxValue={selectedMapIdValue} editor={editor} /> },
        { icon: '', label: 'Voxels', content: <VoxelsInfoView info={res.result().getOk()} selectedVoxelIdxValue={selectedVoxelIdValue} editor={editor} /> },
      ]} active={active} />
}

function EngineContextView({ editor }: { editor: Editor }) {
  const engine = useValue(editor.currentEngine);

  return <Column className='flex-fill'>
    {engine.map(controller => <EngineContextResult editor={editor} result={controller.task} />).orElse(<></>)}
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


export async function createEngines(injector: Injector): Promise<Window> {
  const [actionDescriptors, app, ui, fs, glCtx] = await getInstances(injector, ACTION_DESCRIPTORS, APP, UI, FS, GL_CONTEXT);
  const values = createContainer(ID);
  const windowStates = await app.storages('ui.window-states');
  const state = await createSavedState(values, windowStates, ID, createDefaultState());
  const editor = new Editor(values, state, ui, actionDescriptors, fs, app, glCtx, injector);

  return new WindowBuilder(ID, actionDescriptors, values)
    .titleFromId()
    .minSize(400, 400)
    .sizeValue(state.get('size'))
    .positionValue(state.get('position'))
    .actions(Object.values(editor.actions))
    .disposable(values)
    .build(<EngineContextEditorUiImpl editor={editor} />)
}