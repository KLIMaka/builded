import { SizeType, WindowBuilder } from "@ui/windows-common";
import { Action, ACTION_DESCRIPTORS, ActionDescriptors } from "app/apis/actions";
import { App, APP } from "app/apis/app1";
import { Aliases, ArtInfoExtended, BoardContext, EMPTY_INFO_EXTENDED, EngineContext, NamedArtFile, Palette, PicTags } from "app/apis/engine";
import { UI, Window } from "app/apis/ui1";
import { art } from "build/artraster";
import Optional from "optional-js";
import React from "react";
import { createContainer, Disposable, Source, Value, ValuesContainer, ValuesMap } from "ts-utils/callbacks";
import { getOrCreate, getOrDefault, takeFirst } from "ts-utils/collections";
import { createCanvas } from "ts-utils/imgutils";
import { getInstances, Injector } from "ts-utils/injector";
import { iter } from "ts-utils/iter";
import { fit, palRasterizer, Rasterizer, transform } from "ts-utils/pixelprovider";
import { BiFunction, Consumer, first, Predicate } from "ts-utils/types";
import { createSavedState } from "../default/app/storage";
import { ArtSelectUiImpl } from "./art-select-view";
import { ArtEditor } from "./arteditor-api";
import { getGridOff, GridMove } from "@ui/commons";
import { clamp } from "ts-utils/mathutils";
import { Board } from "build/board/structs";
import { forAllSectors, forAllSprites, forAllWalls } from "build/board/query";

const ID = 'art-select';
const DEFAULT_PREVIEW = 'resources/black.png';

type SavedState = {
  size: SizeType
  position: SizeType,
  previewSize: number,
}

function createDefaultState(): SavedState {
  return {
    size: [600, 600],
    position: ['center', 'center'],
    previewSize: 100,
  };
}

export class ArtSelectImpl implements ArtEditor {
  readonly currentId: Value<number>;
  readonly picnums: Source<number[]>;
  readonly previewSize: Source<number>;
  readonly previewGridSize: Value<Optional<[number, number]>>;
  private rasterizer: Rasterizer<number>;
  private artSource: Source<[Map<number, ArtInfoExtended>, number]>;

  private previewCache = new Map<number, Source<string> & Disposable>();
  readonly actions: Action[];

  constructor(
    readonly values: ValuesContainer,
    readonly state: ValuesMap<SavedState>,
    private actionDescriptors: ActionDescriptors,
    private app: App,
    readonly art: Source<NamedArtFile[]>,
    readonly artInfos: Source<Map<number, ArtInfoExtended>>,
    private pal: Source<Uint8Array>,
    readonly plus: Source<Palette[]>,
    readonly tags: Source<PicTags>,
    private shadowsteps: Source<number>,
    readonly aliases: Source<Aliases>,
    private picnumConsumer: Consumer<number>,
    private boardInfo: BoardPicnumInfo,
  ) {
    this.currentId = this.values.value('currentId', 0);
    this.previewSize = state.get('previewSize');
    this.picnums = values.transformed('picnums', artInfos, artInfos => iter(artInfos.entries())
      .filter(this.picnumFilter())
      .map(first)
      .collect()
      .toSorted(this.sortPicnums()));
    this.previewGridSize = values.value('previewGridSize', Optional.empty());
    this.rasterizer = palRasterizer(pal.get());

    this.artSource = values.tuple([this.artInfos, this.previewSize]);
    this.actions = this.createActions(actionDescriptors);
  }

  private picnumFilter(): Predicate<[number, ArtInfoExtended]> {
    return ([picnum, info]) => {
      if (info.w <= 0 && info.h <= 0) return false;
      if (!this.boardInfo.sectors.has(picnum) && !this.boardInfo.walls.has(picnum)) return false;
      return true;
    }
  }

  private sortPicnums(): BiFunction<number, number, number> {
    return (l, r) => getOrDefault(this.boardInfo.walls, r, 0) - getOrDefault(this.boardInfo.walls, l, 0)
  }

  private offPicnum(off: GridMove) {
    const current = this.currentId.get();
    const picnums = this.picnums.get();
    const idx = picnums.indexOf(current);
    if (idx === -1) this.setCurrentId(takeFirst(picnums).orElse(-1));
    this.previewGridSize.get().ifPresent((size) => this.setCurrentId(picnums[clamp(idx + getGridOff(off, size), 0, picnums.length - 1)]));
  }

  private createActions(actionDescriptors: ActionDescriptors): Action[] {
    const ctx = actionDescriptors.sub(ID);
    const add = (id: string, action: Consumer<void>) => ctx.bindSync(id, action);
    return [
      add('left', () => this.offPicnum('left')),
      add('right', () => this.offPicnum('right')),
      add('up', () => this.offPicnum('up')),
      add('down', () => this.offPicnum('down')),
      add('pageup', () => this.offPicnum('pageup')),
      add('pagedown', () => this.offPicnum('pagedown')),
      add('select', () => this.select())
    ]
  }

  private select(): void {
    this.picnumConsumer(this.currentId.get());
  }

  clickOnPicnum(picnum: number, doubleClick?: boolean): void {
    if (doubleClick ?? false) {
      this.currentId.set(picnum);
      this.select();
    } else {
      this.currentId.set(picnum);
    }
  }

  setCurrentId(picnum: number): void {
    this.currentId.set(picnum);
  }

  getArt(picnum: number): Source<string> {
    const renderPreview = (picnum: number, artFiles: Map<number, ArtInfoExtended>, size: number): Promise<string> =>
      new Promise<string>(ok => {
        const info = getOrDefault(artFiles, picnum, EMPTY_INFO_EXTENDED);
        const p = this.plus.get()[0].plu;
        createCanvas(transform(fit(size - 2, size - 16, art(info), 255), c => c === 255 ? 255 : p[c]), this.rasterizer)
          .toBlob(blob => ok(URL.createObjectURL(blob)))
      });
    return getOrCreate(this.previewCache, picnum, _ =>
      this.values.transformedAsyncBuilder({
        name: `artPreview_${picnum}`,
        source: this.artSource,
        transformer: ([art, size]) => renderPreview(picnum, art, size),
        initialValue: { value: DEFAULT_PREVIEW, mods: -1 },
        disposer: url => { if (url !== DEFAULT_PREVIEW) URL.revokeObjectURL(url) }
      }));
  }
}

type BoardPicnumInfo = {
  sectors: Map<number, number>,
  walls: Map<number, number>,
  sprites: Map<number, number>,
}

function readBoard(board: Board): BoardPicnumInfo {
  const sectors = new Map<number, number>();
  const walls = new Map<number, number>();
  const sprites = new Map<number, number>();
  const count = (map: Map<number, number>, picnum: number) => map.set(picnum, getOrDefault(map, picnum, 0) + 1);
  forAllSectors(board, sec => {
    count(sectors, sec.floorpicnum);
    count(sectors, sec.ceilingpicnum);
  });
  forAllSprites(board, spr => count(sprites, spr.picnum));
  forAllWalls(board, wall => {
    count(walls, wall.picnum);
    count(walls, wall.overpicnum);
  })
  return { sectors, walls, sprites }
}

export async function createArtSelect(injector: Injector, engine: EngineContext, boardCtx: BoardContext, picnumConsumer: Consumer<Optional<number>>): Promise<Window> {
  return await createContainer('art-select-model').initializeAsync(async values => {
    const picnum = values.value<Optional<number>>('picnum', Optional.empty());
    const [actionDescriptors, app] = await getInstances(injector, ACTION_DESCRIPTORS, APP);
    const windowStates = await app.storages('ui.window-states');
    const state = await createSavedState(values, windowStates, ID, createDefaultState());
    const art = engine.art;
    const artMap = engine.artMap;
    const pal = engine.pal;
    const plus = engine.plus;
    const tags = engine.picTags;
    const shadowsteps = engine.shadowsteps;
    const aliases = engine.aliases;
    const select = new ArtSelectImpl(values, state, actionDescriptors, app, art, artMap, pal, plus, tags, shadowsteps, aliases, id => picnum.set(Optional.of(id)), readBoard(boardCtx.board.get()));
    const win = new WindowBuilder(ID, actionDescriptors, values)
      .titleFromId()
      .modal()
      .minSize(400, 400)
      .state(state)
      .actions(select.actions)
      .disposable(values)
      .onClose(() => picnumConsumer(picnum.get()))
      .build(<ArtSelectUiImpl artEditor={select} />)

    values.handleStandalone([picnum], (picnum) => picnum.ifPresent(_ => win.close()))
    return win;
  });
}

export async function selectPicnum(injector: Injector, engine: EngineContext, boardCtx: BoardContext): Promise<Optional<number>> {
  const ui = await injector.getInstance(UI);
  const { promise, resolve } = Promise.withResolvers<Optional<number>>();
  ui.addWindow(await createArtSelect(injector, engine, boardCtx, picnum => resolve(picnum)));
  return promise;
}