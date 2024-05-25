import { ActionItem } from "@ui/action-list";
import { ActionsNode } from "@ui/commons";
import { Source, Value, transformed, transformedAsyncImmediate, tuple, value } from "@utils/callbacks";
import { getOrCreate, getOrDefaultMap, range } from "@utils/collections";
import { createCanvas, drawToCanvas, renderGrid } from "@utils/imgutils";
import { Dependency, Injector, getInstances } from "@utils/injector";
import { iter } from "@utils/iter";
import { cyclic, int } from "@utils/mathutils";
import { applyDefaults } from "@utils/objects";
import { Rasterizer, array, fit, mirrorX, palRasterizer, rect, rectRepeat, resize, superResize, transform } from "@utils/pixelprovider";
import { Consumer, Function, first, nil, second, seq } from "@utils/types";
import { ACTION_DESCRIPTORS, Action, ActionDescriptors } from "app/apis/actions";
import { APP, App, Storage } from "app/apis/app1";
import { EngineContext, NamedArtFile, Palette, PicTags } from "app/apis/engine";
import { Window, WindowRenderer } from "app/apis/ui1";
import { art } from "build/artraster";
import { ArtInfo, EMPTY_INFO, animate } from "build/formats/art";
import React, { createContext, useEffect, useRef } from "react";
import { ArtEditorUiImpl, WorkplaneBuilder } from "./view";

const GRID_SIZES = [0, 4, 8, 16, 32, 64, 128, 256];
const DEFAULT_PREVIEW = 'resources/black.png';

export type ArtEditor = {
  readonly state: Source<SavedState>;
}

type WorkplaneContext = {
  xoff: number,
  yoff: number,
  scale: number,
}

type SavedState = {
  x: number | string,
  y: number | string,
  width: number,
  height: number,
  grid: number,
  previewSize: number,
}

async function createSavedState<T>(storage: Storage, id: string, def: T): Promise<Value<T>> {
  const saver = (s: T) => storage.set(id, s);
  const loadedState = await storage.get<T>(id);
  const state = value(loadedState.map(s => applyDefaults(s, def)).orElse(def));
  state.subscribe(s => saver(s));
  return state;
}

function createDefaultState(): SavedState {
  return {
    x: "center",
    y: "center",
    width: 600,
    height: 600,
    grid: 0,
    previewSize: 100,
  };
}

export const ArtEditorContext = createContext<ArtEditorImpl>(null);
export type ArtEditorActions = {
  next: Action,
  prev: Action,
  center: Action,
  toggleScale: Action
  toggleRepeat: Action,
  toggleGrid: Action,
  gridInc: Action,
  gridDec: Action,
  copy: Action,
}

type RenderType = 'regular' | 'mirrored';
type RenderInfo = {
  info: ArtInfo,
  type: RenderType,
}

type ArtDetailedInfo = {
  info: ArtInfo,
  artFile: string,
}

export class ArtEditorImpl implements ArtEditor {
  private channel: ActionsNode;
  readonly filter = value("");
  readonly currentId = value(0);
  readonly currentPlu = value(0);
  private currentShadow = value(0);
  private animationFrame = value(0);
  private superSample = value(false);
  private repeat = value(false);
  private showEmpty = value(false);
  readonly artFiles: Source<Map<number, ArtDetailedInfo>>;
  readonly picnums: Source<number[]>;
  readonly filteredPicnums: Source<number[]>;
  private mainFrameInfo: Source<ArtInfo>;
  private currentFrameInfo: Source<RenderInfo>;
  private pluProvider: Source<Function<number, number>>;

  private closeBlend = (l: number, r: number, doff: number) => Math.abs(l - r) <= 4 ? this.blendColors(l, r, doff) : null;
  private blend = (l: number, r: number, doff: number) => this.blendColors(l, r, doff);
  private rasterizer: Rasterizer<number>;
  private previewRect = { width: 0, height: 0 };
  readonly previewSize: Value<number>;
  private previewCache = new Map<number, Source<string>>();

  readonly actions: ArtEditorActions;
  readonly ctx = value({ xoff: 0, yoff: 0, scale: 2.5 } as WorkplaneContext);
  readonly gridSizes: Source<ActionItem[]>;
  readonly pluItems: Source<ActionItem[]>;
  readonly gridSize: Value<number>;

  constructor(
    readonly state: Value<SavedState>,
    private actionDescriptors: ActionDescriptors,
    private app: App,
    readonly art: Source<NamedArtFile[]>,
    private pal: Source<Uint8Array>,
    private trans: Source<Uint8Array>,
    readonly plus: Source<Map<number, Palette>>,
    readonly tags: Source<PicTags>,
    private shadowsteps: number
  ) {
    this.gridSize = value(state.get().grid);
    this.previewSize = value(state.get().previewSize);
    this.rasterizer = palRasterizer(pal.get());
    this.artFiles = transformed(this.art, art => this.updateArtCache(art));
    this.picnums = transformed(tuple(this.artFiles, this.showEmpty), ([art, showEmpty]) =>
      iter(art.entries()).filter(([_, { info }]) => showEmpty ? true : info.w !== 0 && info.h !== 0).map(first).collect().sort((l, r) => l - r));
    this.filteredPicnums = transformed(tuple(this.picnums, this.filter, this.tags), ([picnums, filter, tags]) =>
      picnums.filter(p => iter(tags.tags(p)).any(t => t.toLowerCase().startsWith(filter.toLowerCase())) || p.toString().includes(filter)));
    this.mainFrameInfo = transformed(tuple(this.artFiles, this.currentId), ([art, id]) => getOrDefaultMap(art, id, i => i.info, EMPTY_INFO));
    this.currentFrameInfo = transformed(tuple(this.artFiles, this.currentId, this.animationFrame, this.mainFrameInfo),
      ([art, id, frame, mainFrame]) => this.animate(art, id, frame, mainFrame));
    this.pluProvider = transformed(tuple(this.plus, this.currentShadow, this.currentPlu),
      ([plus, shadow, plu]) => x => (x >= 255 || x < 0) ? 255 : plus.get(plu).plu[shadow * 256 + x]);

    this.gridSizes = this.createGridItems();
    this.pluItems = this.createPluItems();
    this.actions = this.createActions(actionDescriptors);

    this.animateFrame();
  }

  private animateFrame() {
    let animationTimerId = -1;
    this.mainFrameInfo.subscribe(main => {
      this.animationFrame.set(0);
      if (animationTimerId !== -1) {
        clearTimeout(animationTimerId);
        animationTimerId = -1;
      }
      if (main.attrs.frames === 0 && (main.attrs.type & 7) !== 1 && (main.attrs.type & 7) !== 2) return;
      const speed = ((main.attrs.type & 7) === 1) || ((main.attrs.type & 7) === 2) ? 150 : Math.pow(2, main.attrs.speed) * 10;
      animationTimerId = window.setInterval(() => this.animationFrame.mod(f => f + 1), speed);
    });
  }

  private animate(art: Map<number, ArtDetailedInfo>, id: number, frame: number, mainFrame: ArtInfo): RenderInfo {
    const getArt = (pid: number) => getOrDefaultMap(art, pid, i => i.info, EMPTY_INFO);
    if ((mainFrame.attrs.type & 7) === 1) {
      const side = frame % 8;
      if (side <= 4) return { type: 'regular', info: getArt(id + side) }
      else return { type: 'mirrored', info: getArt(id + (8 - side)) }
    } else if ((mainFrame.attrs.type & 7) === 2) {
      return { type: 'regular', info: getArt(id + (frame % 8)) }
    }
    else return { type: 'regular', info: getArt(id + animate(frame, mainFrame)) }
  }

  private createActions(actionDescriptors: ActionDescriptors): ArtEditorActions {
    const ctx = actionDescriptors.sub('art-editor');
    return {
      center: ctx.bindSync('center', () => this.centerPic()),
      next: ctx.bindSync('next', () => this.currentId.mod(id => id + 1)),
      prev: ctx.bindSync('prev', () => this.currentId.mod(id => id - 1)),
      toggleScale: ctx.bindSync('toggle-scale', () => this.superSample.mod(s => !s)),
      toggleRepeat: ctx.bindSync('toggle-repeat', () => this.repeat.mod(r => !r)),
      toggleGrid: ctx.bindSync('toggle-grid', () => this.setGrid(g => g === 0 ? 32 : 0)),
      gridDec: ctx.bindSync('grid-dec', () => this.gridStep(-1)),
      gridInc: ctx.bindSync('grid-inc', () => this.gridStep(1)),
      copy: ctx.bind('copy', () => this.copy()),
    }
  }

  private centerPic() {
    const { info } = this.currentFrameInfo.get();
    this.ctx.modImmer(ctx => {
      ctx.xoff = this.previewRect.width / 2 + info.attrs.xoff * ctx.scale;
      ctx.yoff = this.previewRect.height / 2 + info.attrs.yoff * ctx.scale;
    })
  }

  async newWindow(): Promise<WindowRenderer> {
    return (onClose: Consumer<void>, windowConsumer: Consumer<Window>) =>
      <ArtEditorContext.Provider value={this}>
        <ArtEditorUiImpl onClose={seq(onClose)} windowConsumer={windowConsumer} />
      </ArtEditorContext.Provider>
  }

  setSize(width: number, height: number) {
    this.state.modImmer(s => { s.height = height; s.width = width });
  }

  setPosition(x: number, y: number) {
    this.state.modImmer(s => { s.x = x; s.y = y });
  }

  setChannel(channel: ActionsNode) {
    this.channel = channel;
  }

  private setGrid(gridMod: Function<number, number>) {
    const grid = gridMod(this.gridSize.get());
    this.gridSize.set(grid);
    this.state.modImmer(s => s.grid = grid);
  }

  setPreviewSize(sizeMod: Function<number, number>) {
    const size = sizeMod(this.previewSize.get());
    this.previewSize.set(size);
    this.state.modImmer(s => s.previewSize = size);
  }

  rasterWorkplaneRenderer(): WorkplaneBuilder {
    return (canvas) => {
      if (canvas.width === 0 || canvas.height === 0) return nil();
      const w = canvas.width;
      const h = canvas.height;
      const buffer = new Uint8ClampedArray(w * h * 4);
      const id = new ImageData(buffer, w, h);
      [this.previewRect.width, this.previewRect.height] = [id.width, id.height];
      this.centerPic();
      const render = () => setTimeout(() => this.renderFrame(canvas, id));
      render();
      return tuple(this.ctx, this.currentFrameInfo, this.superSample, this.repeat, this.pluProvider).subscribe(_ => render());
    }
  }

  private renderFrame(canvas: HTMLCanvasElement, id: ImageData) {
    const wctx = this.ctx.get();
    const { type, info } = this.currentFrameInfo.get();
    const raster = type === "mirrored"
      ? mirrorX(transform(art(info), this.pluProvider.get()))
      : transform(art(info), this.pluProvider.get());
    const ctx = canvas.getContext('2d');
    const w = raster.width * wctx.scale;
    const h = raster.height * wctx.scale;
    const attrXoff = type === 'regular' ? info.attrs.xoff : -info.attrs.xoff;
    const xoff = -wctx.xoff + (int(info.w / 2) + attrXoff) * wctx.scale
    const yoff = -wctx.yoff + (int(info.h / 2) + info.attrs.yoff) * wctx.scale
    const scaled = this.superSample.get()
      ? superResize(raster, w, h, this.closeBlend, this.blend)
      : resize(raster, w, h);
    const framed = this.repeat.get()
      ? rectRepeat(scaled, xoff, yoff, id.width + xoff, id.height + yoff)
      : rect(scaled, xoff, yoff, id.width + xoff, id.height + yoff, 0);
    id.data.fill(0);
    this.rasterizer(framed, id.data);
    ctx.putImageData(id, 0, 0);
  }

  gridRenderer(): WorkplaneBuilder {
    return (canvas: HTMLCanvasElement) => {
      const render = (ctx: WorkplaneContext, grid: number) => renderGrid(canvas, ctx.xoff, ctx.yoff, ctx.scale, grid, grid * grid);
      render(this.ctx.get(), this.gridSize.get());
      return tuple(this.ctx, this.gridSize).subscribe(([ctx, grid]) => render(ctx, grid));
    }
  }

  centerRenderer(): WorkplaneBuilder {
    return (canvas) => {
      const render = () => {
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'white';
        ctx.fillRect(-2 + this.ctx.get().xoff, -2 + this.ctx.get().yoff, 4, 4);
      }
      render();
      return this.ctx.subscribe(_ => render());
    }
  }

  imageInfoRenderer(): WorkplaneBuilder {
    return (canvas) => {
      const render = () => {
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        const pal = this.pal.get();
        const plu = this.pluProvider.get();
        const { info } = this.currentFrameInfo.get();
        // const lum = iter(range(0, 255)).map(plu).map(i => rgb2lum(pal[i * 3], pal[i * 3 + 1], pal[i * 3 + 2])).collect();
        // const palByLum = [...range(0, 255)].sort((l, r) => lum[l] - lum[r]);
        const palByLum = [...range(0, 255)];

        const stats: number[] = new Array(256).fill(0);
        iter(info.img).forEach(x => stats[x]++);
        stats[255] = 0;
        const max = Math.max(...stats);
        iter(palByLum).enumerate().forEach(([p, i]) => {
          const r = pal[plu(p) * 3];
          const g = pal[plu(p) * 3 + 1];
          const b = pal[plu(p) * 3 + 2];
          ctx.fillStyle = `rgb(${r} ${g} ${b})`;
          const bar = 4 + Math.ceil(stats[p] / max * 40);
          ctx.fillRect(i * 2, h - bar, 2, bar);
          ctx.fillStyle = `white`;
          ctx.fillRect(i * 2, h - bar - 1, 2, 1);
        })
      }
      render();
      return tuple(this.currentFrameInfo, this.pluProvider).subscribe(_ => render());
    }
  }

  getArt(picnum: number, size: number): Source<string> {
    const renderPreview = (picnum: number, artFiles: Map<number, ArtDetailedInfo>) =>
      new Promise<string>(ok => setTimeout(() => {
        createCanvas(fit(size - 2, size - 16, art(getOrDefaultMap(artFiles, picnum, i => i.info, EMPTY_INFO)), 0), this.rasterizer).toBlob(blob =>
          ok(URL.createObjectURL(blob)))
      }));
    return getOrCreate(this.previewCache, picnum, _ => transformedAsyncImmediate(this.artFiles, DEFAULT_PREVIEW, art => renderPreview(picnum, art)));
  }

  setCurrentId(picnum: number) {
    this.currentId.set(picnum);
    this.centerPic();
  }

  private blendColors(l: number, r: number, doff: number) {
    if (l !== 255 && r !== 255) return this.trans.get()[l * 256 + r];
    else return doff >= 0.5 ? l : r;
  }

  private createGridItems(): Source<ActionItem[]> {
    const item = (size: number, currentSize: number): ActionItem => {
      return {
        selected: size === currentSize,
        element: <div>{size === 0 ? 'None' : `${size}px`}</div>,
        action: () => this.setGrid(_ => size),
      }
    }
    return transformed(this.gridSize, grid => GRID_SIZES.map(s => item(s, grid)))
  }

  private gridStep(d: number) {
    this.setGrid(grid => {
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
    return transformed(tuple(this.plus, this.currentPlu), ([plus, currentPlu]) =>
      iter(plus.entries()).map(([pid, p]) => item(p, pid, currentPlu)).collect())
  }

  private updateArtCache(artFiles: NamedArtFile[]): Map<number, ArtDetailedInfo> {
    return iter(artFiles)
      .map(file => iter(file.art.arts)
        .enumerate()
        .map(([info, i]) => [file.art.header.start + i, { info, artFile: file.name }] as [number, ArtDetailedInfo]))
      .flatten()
      .toMap(first, second)
  }

  private async copy() {
    const info = this.mainFrameInfo.get();
    createCanvas(art(info), palRasterizer(this.pal.get(), 255, [0, 0, 0, 0])).toBlob(async blob => {
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blob
        })
      ]);
    }, 'image/png');
  }
}

export async function createArtEditor(injector: Injector, engine: EngineContext<any>) {
  const [actionDescriptors, app] = await getInstances(injector, ACTION_DESCRIPTORS, APP);
  const windowStates = await app.storages('ui.window-states');
  const state = await createSavedState(windowStates, 'art-editor', createDefaultState());
  const art = await engine.art;
  const pal = await engine.pal;
  const trans = await engine.trans;
  const plus = await engine.plus;
  const tags = await engine.picTags;
  return new ArtEditorImpl(state, actionDescriptors, app, art, pal, trans, plus, tags, 64);
}

export const ART_EDITOR = new Dependency<ArtEditor>('ART Editor');