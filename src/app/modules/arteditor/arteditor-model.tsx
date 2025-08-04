import { ActionItem } from "@ui/action-list";
import { GridMove, WorkplaneBuilder, WorkplaneContext, defaultWorkplaneContext, getGridOff, line, menuItemDescripted, workplane } from "@ui/commons";
import { SizeType, WindowBuilder } from "@ui/windows-common";
import { ACTION_DESCRIPTORS, Action, ActionDescriptors } from "app/apis/actions";
import { APP, App } from "app/apis/app1";
import { Aliases, ArtInfoExtended, EMPTY_INFO_EXTENDED, EngineContext, NamedArtFile, Palette, PicTags } from "app/apis/engine";
import { Window } from "app/apis/ui1";
import { art } from "build/artraster";
import { ArtInfo, animate } from "build/formats/art";
import Optional from "optional-js";
import React, { useEffect, useRef } from "react";
import { Disposable, Signal, Source, Value, ValuesContainer, ValuesMap, createContainer } from "ts-utils/callbacks";
import { getOrCreate, getOrDefault, prefixNotEmpty, range, takeFirst } from "ts-utils/collections";
import { createCanvas, drawToCanvas, renderGrid } from "ts-utils/imgutils";
import { Injector, getInstances } from "ts-utils/injector";
import { iter } from "ts-utils/iter";
import { clamp, cyclic } from "ts-utils/mathutils";
import { Navigator, navigateList } from "ts-utils/navigators";
import { Rasterizer, array, fit, palRasterizer, transform } from "ts-utils/pixelprovider";
import { Consumer, Function, Predicate, Supplier, first, second } from "ts-utils/types";
import { createSavedState } from "../default/app/storage";
import { ArtEditorUiImpl } from "./arteditor-view";
import { ArtEditor } from "./arteditor-api";

const GRID_SIZES = [0, 4, 8, 16, 32, 64, 128, 256];
const PREVIEW_SIZES = [32, 64, 100, 128, 125, 200];
const SUPER_SAMPLE_SETTINGS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 16];
const DEFAULT_PREVIEW = 'resources/black.png';

type SavedState = {
  size: SizeType
  position: SizeType,
  grid: number,
  previewSize: number,
  superSample: number,
  upscalePreview: boolean,
}

function createDefaultState(): SavedState {
  return {
    size: [600, 600],
    position: ['center', 'center'],
    grid: 0,
    previewSize: 100,
    superSample: 0,
    upscalePreview: false,
  };
}

export type ArtEditorActions = {
  right: Action,
  left: Action,
  up: Action,
  down: Action,
  pageup: Action,
  pagedown: Action,
  center: Action,
  toggleSuperSample: Action
  toggleRepeat: Action,
  toggleGrid: Action,
  gridInc: Action,
  gridDec: Action,
  copy: Action,
  gridMenu: Action,
  pluMenu: Action,
  search: Action,
  clearSearch: Action,
  nextPlu: Action,
  prevPlu: Action,
  resetPlu: Action,
  toggleUpscalePreview: Action,
}

export type RenderType = 'regular' | 'mirrored';
export type RenderInfo = {
  picnum: number,
  info: ArtInfo,
  type: RenderType,
}

function sizePredicate(query: string): (w: number, h: number) => boolean {
  if (!query.startsWith('size')) return _ => false;
  query = query.replace('size', '');
  let relaxed = false;
  if (query.startsWith('?')) {
    relaxed = true;
    query = query.substring(1);
  }
  const xIdx = query.indexOf('x');
  if (relaxed) {
    const size = Number.parseInt(query);
    return (w, h) => w === size || h === size;
  } else if (xIdx === -1) {
    const size = Number.parseInt(query);
    return (w, h) => w === size && h === size;
  } else if (xIdx === 0) {
    const size = Number.parseInt(query.substring(1));
    return (w, h) => h === size
  } else if (xIdx === query.length - 1) {
    const size = Number.parseInt(query.substring(0, xIdx));
    return (w, h) => w === size
  } else {
    const qw = Number.parseInt(query.substring(0, xIdx));
    const qh = Number.parseInt(query.substring(xIdx + 1));
    return (w, h) => w === qw && h === qh
  }
}

function artFilePredicate(query: string): Predicate<string> {
  if (!query.startsWith('art')) return _ => false;
  query = query.replace('art', '');
  return artFile => artFile.includes(query.padStart(3, '0'));
}

function specialPredicate(query: string): Predicate<ArtInfoExtended> {
  if (query === 'anim') return info => info.attrs.animType !== 0 && info.attrs.frames !== 0;
  if (query === 'off') return info => info.attrs.xoff !== 0 || info.attrs.yoff !== 0;
  return _ => false;
}


function filterPicnum(artFiles: Map<number, ArtInfoExtended>, query: string, tags: PicTags, aliases: Aliases): number[] {
  const queryLc = query.toLowerCase();
  const mathTags = iter(tags.allTags()).filter(t => t.toLowerCase().includes(queryLc)).collect();
  const byTag = (picnum: number) => iter(tags.tags(picnum)).any(t => mathTags.includes(t));
  const byId = (picnum: number) => picnum.toString().startsWith(queryLc);
  const bySize = sizePredicate(queryLc);
  const byArtFile = artFilePredicate(queryLc);
  const bySpecial = specialPredicate(queryLc);
  const byAlias = (picnum: number) => aliases.get(picnum).toLowerCase().includes(queryLc);
  return iter(artFiles.entries())
    .filter(([picnum, info]) => byId(picnum) || byTag(picnum) || bySize(info.w, info.h) || byArtFile(info.artFile) || bySpecial(info) || byAlias(picnum))
    .map(first)
    .collect()
    .sort((l, r) => l - r);
}

export class ArtEditorImpl implements ArtEditor {
  readonly searchQuery: Value<string>;
  private searchHistory: Value<string[]>;
  readonly currentId: Value<number>;
  readonly currentPlu: Value<number>;
  private currentShadow: Value<number>;
  private animationFrame: Value<number>;
  readonly superSample: Value<number>;
  readonly repeat: Value<boolean>;
  private showEmpty: Value<boolean>;
  private upscalePreview: Value<boolean>;
  readonly preFilteredArtInfos: Source<Map<number, ArtInfoExtended>>;
  readonly picnums: Source<number[]>;
  private mainFrameInfo: Source<ArtInfo> & Disposable;
  private currentFrameInfo: Source<RenderInfo>;
  private pluProvider: Source<Function<number, number>>;
  readonly previewGridSize: Value<Optional<[number, number]>>;

  private rasterizer: Rasterizer<number>;
  private previewRect: Supplier<[number, number]> = () => [0, 0];
  readonly previewSize: Value<number>;
  private previewCache = new Map<number, Source<string> & Disposable>();

  readonly actions: ArtEditorActions;
  readonly ctx: Value<WorkplaneContext>;
  readonly ctxScaleOff: Value<Pick<WorkplaneContext, 'scale' | 'xoff1' | 'yoff1' | 'xoff2' | 'yoff2'>>;
  readonly gridSizes: Source<ActionItem[]>;
  readonly previewSizes: Source<ActionItem[]>;
  readonly superSamples: Source<ActionItem[]>;
  readonly pluItems: Source<ActionItem[]>;
  readonly pluNavigator: Source<Navigator>;
  readonly gridSize: Value<number>;
  readonly gridMenuOpen: Value<boolean>;
  readonly pluMenuOpen: Value<boolean>;
  readonly superSampleMenuOpen: Value<boolean>;
  readonly previewSizesOpen: Value<boolean>;
  readonly searchSignal: Signal;
  private artSource: Source<[Map<number, ArtInfoExtended>, number, boolean, number]>;

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
    // private previewRenderer: PreviewRenderer,
    readonly aliases: Source<Aliases>
  ) {
    this.searchQuery = this.values.value('searchQuery', "");
    this.searchHistory = this.values.transformedSelf('searchHistory', this.searchQuery, [], (q, self) => this.updateSearchHistory(q, self));
    this.currentId = this.values.value('currentId', 0);
    this.currentPlu = this.values.value('currentPlu', 0);
    this.currentShadow = this.values.value('currentShadow', 0);
    this.animationFrame = this.values.value('animationFrame', 0);
    this.superSample = this.state.get('superSample');
    this.repeat = this.values.value('repeat', false);
    this.showEmpty = this.values.value('showEmpty', false);
    this.ctx = this.values.value('ctx', defaultWorkplaneContext({ scale: 2 }));
    this.ctxScaleOff = this.values.fields('ctxScaleOff', this.ctx, 'scale', 'xoff1', 'yoff1', 'xoff2', 'yoff2');
    this.gridSize = state.get('grid');
    this.previewSize = state.get('previewSize');
    this.rasterizer = palRasterizer(pal.get());
    this.preFilteredArtInfos = this.values.transformedTuple('preFilteredArtInfos', [this.artInfos, this.showEmpty], ([art, showEmpty]) =>
      iter(art.entries()).filter(([_, info]) => showEmpty ? true : info.w !== 0 && info.h !== 0).toMap(first, second));
    this.picnums = this.values.transformedTuple('picnums', [this.preFilteredArtInfos, this.searchQuery, this.tags, this.aliases], ([infos, filter, tags, aliases]) => filterPicnum(infos, filter, tags, aliases));
    this.mainFrameInfo = this.values.transformedTuple('mainFrameInfo', [this.artInfos, this.currentId], ([art, id]) => getOrDefault(art, id, EMPTY_INFO_EXTENDED));
    this.currentFrameInfo = this.values.transformedTuple('currentFrameInfo', [this.artInfos, this.currentId, this.animationFrame, this.mainFrameInfo],
      ([art, id, frame, mainFrame]) => this.animate(art, id, frame, mainFrame));
    this.pluProvider = this.values.transformedTuple('pluProvider', [this.plus, this.currentShadow, this.currentPlu],
      ([plus, shadow, plu]) => { const actualPlu = iter(plus).first(p => p.id === plu).orElse(plus[0]).plu; return x => (x >= 255 || x < 0) ? 255 : actualPlu[shadow * 256 + x] });

    this.previewGridSize = values.value('previewGridSize', Optional.empty());
    this.gridSizes = this.createGridItems();
    this.previewSizes = this.createPreviewSizes();
    this.superSamples = this.createSuperSampleItems()
    this.pluItems = this.createPluItems();
    this.pluNavigator = this.createPluNavigator();
    this.actions = this.createActions(actionDescriptors);
    this.gridMenuOpen = values.value('gridMenuOpen', false);
    this.pluMenuOpen = values.value('pluMenuOpen', false);
    this.superSampleMenuOpen = values.value('superSampleMenuOpen', false);
    this.previewSizesOpen = values.value('previewSizesOpen', false);
    this.searchSignal = values.signal();
    this.upscalePreview = this.state.get('upscalePreview');
    this.artSource = values.tuple([this.artInfos, this.currentPlu, this.upscalePreview, this.previewSize]);

    this.animateFrame();
  }

  clickOnPicnum(picnum: number, doubleClick?: boolean): void {
    this.currentId.set(picnum);
  }

  private animateFrame() {
    const anim = this.app.timer.periodic(() => this.animationFrame.mod(f => f + 1))
    this.values.addSubscribed(this.mainFrameInfo, main => {
      this.animationFrame.set(0);
      anim.stop();
      if (main.attrs.frames === 0 && (main.attrs.type & 7) !== 1 && (main.attrs.type & 7) !== 2) return;
      const speed = ((main.attrs.type & 7) === 1) || ((main.attrs.type & 7) === 2) ? 150 : Math.pow(2, main.attrs.speed) * 10;
      anim.start(speed);
    });
    this.values.addDisposable(anim);
  }

  private animate(art: Map<number, ArtInfoExtended>, id: number, frame: number, mainFrame: ArtInfo): RenderInfo {
    const getArt = (pid: number) => getOrDefault(art, pid, EMPTY_INFO_EXTENDED);
    if ((mainFrame.attrs.type & 7) === 1) {
      const side = frame % 8;
      if (side <= 4) return { type: 'regular', info: getArt(id + side), picnum: id + side }
      else return { type: 'mirrored', info: getArt(id + (8 - side)), picnum: id + (8 - side) }
    } else if ((mainFrame.attrs.type & 7) === 2) {
      return { type: 'regular', info: getArt(id + (frame % 8)), picnum: id + (frame % 8) }
    }
    else return { type: 'regular', info: getArt(id + animate(frame, mainFrame)), picnum: id + animate(frame, mainFrame) }
  }

  private offPicnum(off: GridMove) {
    const current = this.currentId.get();
    const picnums = this.picnums.get();
    const idx = picnums.indexOf(current);
    if (idx === -1) this.setCurrentId(takeFirst(picnums).orElse(-1));
    this.previewGridSize.get().ifPresent((size) => this.setCurrentId(picnums[clamp(idx + getGridOff(off, size), 0, picnums.length - 1)]));
  }

  private createActions(actionDescriptors: ActionDescriptors): ArtEditorActions {
    const ctx = actionDescriptors.sub('art-editor');
    const add = (id: string, action: Consumer<void>) => ctx.bindSync(id, action);
    return {
      center: add('center', () => this.centerPic()),
      left: add('left', () => this.offPicnum('left')),
      right: add('right', () => this.offPicnum('right')),
      up: add('up', () => this.offPicnum('up')),
      down: add('down', () => this.offPicnum('down')),
      pageup: add('pageup', () => this.offPicnum('pageup')),
      pagedown: add('pagedown', () => this.offPicnum('pagedown')),
      toggleSuperSample: add('toggle-scale', () => this.superSample.mod(s => cyclic(s + 1, 16))),
      toggleRepeat: add('toggle-repeat', () => this.repeat.mod(r => !r)),
      toggleGrid: add('toggle-grid', () => this.gridSize.mod(g => g === 0 ? 32 : 0)),
      gridDec: add('grid-dec', () => this.gridStep(-1)),
      gridInc: add('grid-inc', () => this.gridStep(1)),
      copy: ctx.bind('copy', () => this.copy()),
      gridMenu: add('grid', () => this.gridMenuOpen.set(true)),
      pluMenu: add('plu', () => this.pluMenuOpen.set(true)),
      search: add('search', () => this.searchSignal.call()),
      clearSearch: add('clear-search', () => this.searchQuery.set('')),
      nextPlu: add('next-plu', () => this.pluNavigator.get()('next')),
      prevPlu: add('prev-plu', () => this.pluNavigator.get()('prev')),
      resetPlu: add('reset-plu', () => this.currentPlu.set(0)),
      toggleUpscalePreview: add('toggle-upscale-preview', () => this.upscalePreview.mod(u => !u)),
    }
  }

  private centerPic() {
    const { info } = this.currentFrameInfo.get();
    this.ctx.modImmer(ctx => {
      const [w, h] = this.previewRect();
      ctx.xoff1 = w / 2 + info.attrs.xoff * ctx.scale;
      ctx.yoff1 = h / 2 + info.attrs.yoff * ctx.scale;
      ctx.xoff2 = 0;
      ctx.yoff2 = 0;
    })
  }

  rasterWorkplaneRenderer(): WorkplaneBuilder {
    return workplane((canvas, width, height) => {
      this.previewRect = () => [width, height];
      this.centerPic();
      return this.values.handle([this.ctxScaleOff, this.currentFrameInfo, this.superSample, this.repeat, this.currentPlu],
        ([ctx, info, ss, repeat, plu]) => {/*this.previewRenderer.draw(canvas, ctx, info, plu, ss, repeat)*/ }
      );
    });
  }

  gridRenderer(): WorkplaneBuilder {
    return workplane(canvas => {
      const render = (ctx: Pick<WorkplaneContext, 'xoff1' | 'yoff1' | 'scale'>, grid: number) => renderGrid(canvas, ctx.xoff1, ctx.yoff1, ctx.scale, grid, grid * grid);
      return this.values.handle([this.ctxScaleOff, this.gridSize], ([ctx, grid]) => render(ctx, grid));
    })
  }

  // centerRenderer(): WorkplaneBuilder {
  //   return workplane((canvas, w, h) => {
  //     const render = (wctx: Pick<WorkplaneContext, 'xoff1' | 'yoff1'>) => {
  //       const ctx = canvas.getContext('2d');
  //       ctx.clearRect(0, 0, w, h);
  //       ctx.fillStyle = 'white';
  //       ctx.fillRect(-2 + wctx.xoff1, -2 + wctx.yoff1, 4, 4);
  //     }
  //     return this.values.handle([this.ctxScaleOff], ctx => render(ctx));
  //   })
  // }

  imageInfoRenderer(): WorkplaneBuilder {
    return workplane((canvas, w, h) => {
      const render = (pal: Uint8Array, frameInfo: RenderInfo, plu: Function<number, number>) => {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);

        const { info } = frameInfo;
        // const lum = iter(range(0, 255)).map(plu).map(i => rgb2lum(pal[i * 3], pal[i * 3 + 1], pal[i * 3 + 2])).collect();
        // const palByLum = [...range(0, 255)].sort((l, r) => lum[l] - lum[r]);
        const palByLum = [...range(0, 255)];

        const stats: number[] = new Array(256).fill(0);
        iter(info.img).forEach(x => stats[x]++);
        stats[255] = 0;
        const max = Math.max(...stats);
        iter(palByLum).enumerate().forEach(([p, i]) => {
          const or = pal[p * 3];
          const og = pal[p * 3 + 1];
          const ob = pal[p * 3 + 2];
          ctx.fillStyle = `rgb(${or} ${og} ${ob})`;
          ctx.fillRect(i * 2, h - 4, 2, 4);
          const r = pal[plu(p) * 3];
          const g = pal[plu(p) * 3 + 1];
          const b = pal[plu(p) * 3 + 2];
          ctx.fillStyle = `rgb(${r} ${g} ${b})`;
          const bar = 4 + Math.ceil(stats[p] / max * 40);
          ctx.fillRect(i * 2, h - bar - 4, 2, bar);
          ctx.fillStyle = `white`;
          ctx.fillRect(i * 2, h - bar - 1 - 4, 2, 1);
        })
      }
      return this.values.handle([this.pal, this.currentFrameInfo, this.pluProvider], ([pal, frameInfo, plu]) => render(pal, frameInfo, plu));
    })
  }

  getArt(picnum: number): Source<string> {
    const renderPreview = (picnum: number, artFiles: Map<number, ArtInfoExtended>, plu: number, upscale: boolean, size: number): Promise<string> =>
      new Promise<string>(ok => {
        const info = getOrDefault(artFiles, picnum, EMPTY_INFO_EXTENDED);
        const p = iter(this.plus.get()).first(p => p.id === plu).orElse(this.plus.get()[0]).plu;
        createCanvas(transform(fit(size - 2, size - 16, art(info), 255, upscale), c => c === 255 ? 255 : p[c]), this.rasterizer)
          .toBlob(blob => ok(URL.createObjectURL(blob)))
      });
    return getOrCreate(this.previewCache, picnum, _ =>
      this.values.transformedAsyncBuilder({
        name: `artPreview_${picnum}`,
        source: this.artSource,
        transformer: ([art, plu, upscale, size]) => renderPreview(picnum, art, plu, upscale, size),
        initialValue: { value: DEFAULT_PREVIEW, mods: -1 },
        disposer: url => { if (url !== DEFAULT_PREVIEW) URL.revokeObjectURL(url) }
      }));
  }

  setCurrentId(picnum: number) {
    this.currentId.set(picnum);
    // this.centerPic();
  }

  private updateSearchHistory(q: string, prevList: string[]): string[] {
    if (q === '') return prevList;
    const [first, ...rest] = prevList;
    if (first && (first.includes(q) || q.includes(first))) {
      return [first.length > q.length ? first : q, ...rest.filter(s => s !== q)];
    } else {
      return [q, ...prevList.filter(s => s !== q).slice(0, 10)];
    }
  }

  private containsInSearchHistory(q: string): boolean {
    return this.searchHistory.get().find(s => s.toLowerCase() === q) !== undefined;
  }

  searchOracle(): ActionItem[] {
    const action = (query: string) => this.searchQuery.set(query);
    const query = this.searchQuery.get().toLowerCase();
    const element = (text: string) => <div className="text-ellipsis flex-fill text-stretch">{text}</div>;
    return iter(prefixNotEmpty([line('Last')],
      iter(this.searchHistory.get())
        .filter(s => s.toLowerCase().includes(query))
        .map(s => { return { action: () => action(s), element: element(s) } })))
      .chain(
        prefixNotEmpty([line('Tags')],
          iter(this.tags.get().allTags())
            .filter(tag => !this.containsInSearchHistory(tag.toLowerCase()) && tag.toLowerCase().includes(query))
            .map(tag => { return { action: () => action(tag), element: element(tag) } })))
      .chain(
        prefixNotEmpty([line('Size')],
          iter([['size32', '32x32px'], ['size128x64', '128x64px'], ['size32x', '32x?px'], ['sizex128', '?x128px'], ['size?64', '64x?px or ?x64px']])
            .filter(s => 'size'.startsWith(query))
            .map(([title, desc]) => menuItemDescripted(title, desc, () => action(title)))))
      .chain(
        prefixNotEmpty([line('ART File')],
          iter([['art001', 'tiles001.art'], ['art11', 'tiles011.art'], ['art3', 'tiles003.art']])
            .filter(s => 'art'.startsWith(query))
            .map(([title, desc]) => menuItemDescripted(title, desc, () => action(title)))))
      .chain(
        prefixNotEmpty([line('Spacial')],
          iter([['anim', 'Animated'], ['off', 'Has offset'], ['$SHELL', "Has alias 'SHELL'"]])
            .filter(s => 'anim'.startsWith(query) || 'off'.startsWith(query))
            .map(([title, desc]) => menuItemDescripted(title, desc, () => action(title)))))
      .chain(
        prefixNotEmpty([line('Aliases')],
          iter(this.aliases.get().all().entries())
            .filter(([_, a]) => !this.containsInSearchHistory(a.toLowerCase()) && a.toLowerCase().includes(query))
            .map(([picnum, a]) => menuItemDescripted(a, picnum.toString(), () => action(a)))))
      .collect()
  }

  private createGridItems(): Source<ActionItem[]> {
    const item = (size: number, currentSize: number): ActionItem => {
      return {
        selected: size === currentSize,
        element: <div>{size === 0 ? 'None' : `${size}px`}</div>,
        action: () => this.gridSize.set(size),
      }
    }
    return this.values.transformed('gridItems', this.gridSize, grid => GRID_SIZES.map(s => item(s, grid)))
  }

  private createPreviewSizes(): Source<ActionItem[]> {
    const item = (size: number, currentSize: number): ActionItem => {
      return {
        selected: size === currentSize,
        element: <div>{`${size}px`}</div>,
        action: () => this.previewSize.set(size),
      }
    }
    return this.values.transformed('previewSizes', this.previewSize, grid => PREVIEW_SIZES.map(s => item(s, grid)))
  }

  private createSuperSampleItems(): Source<ActionItem[]> {
    const item = (ss: number, currentSS: number): ActionItem => {
      return {
        selected: ss === currentSS,
        element: <div>{ss === 0 ? 'None' : `${ss}`}</div>,
        action: () => this.superSample.set(ss),
      }
    }
    return this.values.transformed('superSampleSizes', this.superSample, ss => SUPER_SAMPLE_SETTINGS.map(s => item(s, ss)))
  }

  private gridStep(d: number) {
    this.gridSize.mod(grid => {
      const idx = GRID_SIZES.indexOf(grid);
      return GRID_SIZES[cyclic(idx + d, GRID_SIZES.length)];
    });
  }

  private createPluItems(): Source<ActionItem[]> {
    const Preview = ({ plu }: { plu: Palette }) => {
      const ref = useRef<HTMLCanvasElement>();
      useEffect(() => { drawToCanvas(transform(array([...range(0, 256)], 16, 16), i => plu.plu[i]), ref.current.getContext('2d'), this.rasterizer) }, [plu.plu]);
      return <canvas ref={ref} width={16} height={16} />;
    }
    const item = (plu: Palette, pid: number, currentPlu: number): ActionItem => {
      return {
        selected: pid === currentPlu,
        element: <div className="row-block baseline-aligned gap-5"><Preview plu={plu} /><div>{plu.name}</div></div>,
        action: () => this.currentPlu.set(pid),
      }
    }
    return this.values.transformedTuple('pluItems', [this.plus, this.currentPlu], ([plus, currentPlu]) =>
      iter(plus).enumerate().map(([p, pid]) => item(p, pid, currentPlu)).collect())
  }

  private createPluNavigator(): Source<Navigator> {
    return this.values.transformed('pluNavigator', this.plus, plus => navigateList(this.currentPlu, () => [...range(0, plus.length)]))
  }

  private async copy() {
    const info = this.mainFrameInfo.get();
    createCanvas(art(info), palRasterizer(this.pal.get(), 255, [0, 0, 0, 0])).toBlob(async blob => {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    }, 'image/png');
  }
}

export async function createArtEditor(injector: Injector, ctx: EngineContext): Promise<Window> {
  return createContainer('art-editor-model').initializeAsync(async values => {
    const [actionDescriptors, app] = await getInstances(injector, ACTION_DESCRIPTORS, APP);
    const windowStates = await app.storages('ui.window-states');
    const state = await createSavedState(values, windowStates, 'art-editor', createDefaultState());
    const art = ctx.art;
    const artMap = ctx.artMap;
    const pal = ctx.pal;
    const plus = ctx.plus;
    const tags = ctx.picTags;
    const shadowsteps = ctx.shadowsteps;
    const aliases = ctx.aliases;
    // const previewRenderer = await createPreviewRenderer(values, glCtx, ctx);
    const editor = new ArtEditorImpl(values, state, actionDescriptors, app, art, artMap, pal, plus, tags, shadowsteps, aliases);

    return new WindowBuilder('art-editor', actionDescriptors, values)
      .titleFromId()
      .minSize(400, 400)
      .state(state)
      .actions(Object.values(editor.actions))
      .disposable(values)
      // .disposable(previewRenderer)
      .build(<ArtEditorUiImpl artEditor={editor} />)
  });
}