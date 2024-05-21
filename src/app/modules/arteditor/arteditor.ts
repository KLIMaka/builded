import { int } from "@utils/mathutils";
import { cyclicToggler } from "@utils/objects";
import { Consumer, Function, Supplier } from "@utils/types";
import { INT_MODEL, NumberModelBuilder, numberBox } from "@utils/ui/controls/numberbox";
import { props, widgetProp } from "@utils/ui/renderers";
import { Action, ActionDescriptors } from "app/apis/actions";
import { ArtProvider, EngineContext, Palette, PicTags } from "app/apis/engine";
import Optional from "optional-js";
import { art } from "../../../build/artraster";
import { ArtInfo, Attributes, animate } from "../../../build/formats/art";
import { Source, handle, transformed, tuple, value } from "../../../utils/callbacks";
import { range } from "../../../utils/collections";
import { iter } from "../../../utils/iter";
import { Raster, Rasterizer, palRasterizer, rect, rectRepeat, resize, superResize, transform } from "../../../utils/pixelprovider";
import { DrawPanel, ScrollType } from "../../../utils/ui/drawpanel";
import { ActionsWidget, Block, Ui, Window, WindowBuilder, blockActions, style } from "../../apis/ui";
import { PicNumCallback } from "../../edit/tools/selection";
import { Workplane, WorkplaneRendererBuilder, createImageDataCache, renderGrid } from "../painter/workplane";
import { listBuilder, singleActionWidget, suggestedTextBox } from "../ui/builders";

function createDrawPanel(
  rasterizer: Rasterizer<number>,
  rasterProvider: Source<Function<number, Raster<number>>>,
  canvas: Block,
  cb: PicNumCallback,
  iter: Supplier<Iterable<number>>
) {
  const rasters = rasterProvider.get();
  const panel = new DrawPanel(canvas, iter, rasters, rasterizer, 0, cb);
  rasterProvider.subscribe(p => panel.setSource(p));
  return panel;
}

export async function ArtEditorModule(ui: Ui, engine: EngineContext<any>): Promise<ArtEditor> {
  const art = await engine.art;
  const pal = await engine.pal;
  const trans = await engine.trans;
  const plus = await engine.plus;
  const tags = await engine.picTags;
  return new ArtEditor(ui, art, pal, trans, plus, tags, 64)
}

const VOID_ART_INFO = new ArtInfo(0, 0, new Attributes(), new Uint8Array());

export class ArtEditor {
  private window: Window;
  private drawPanel: DrawPanel<number>;
  private workplane: Workplane;
  private filter = value("");
  private currentId = value(0);
  private currentPlu = value(0);
  private currentShadow = value(0);
  private animationFrame = value(0);
  private gridSize = value(32);
  private superSample = value(true);
  private repeat = value(false);
  private mainFrameInfo = transformed(this.currentId, id => this.arts(id).get().orElse(VOID_ART_INFO));
  private currentFrameInfo = transformed(tuple(this.currentId, this.animationFrame, this.mainFrameInfo),
    ([id, frame, mainFrame]) => this.arts(id + animate(frame, mainFrame)).get().orElse(VOID_ART_INFO));
  private pluProvider = transformed(tuple(this.currentShadow, this.currentPlu),
    ([shadow, plu]) => (x: number): number => (x >= 255 || x < 0) ? 255 : this.plus.get().get(plu).plu[shadow * 256 + x]);
  private rasterProvider = transformed(this.pluProvider, plu => (i: number) => transform(art(this.arts(i).get().orElse(VOID_ART_INFO)), plu));

  private closeBlend = (l: number, r: number, doff: number) => Math.abs(l - r) <= 4 ? this.blendColors(l, r, doff) : null;
  private blend = (l: number, r: number, doff: number) => this.blendColors(l, r, doff);
  private rasterizer: Rasterizer<number>;
  private centerPic: Consumer<void>;

  private actions: Action[] = [];
  private aCtx: ActionDescriptors;

  constructor(
    private ui: Ui,
    private arts: ArtProvider,
    private pal: Source<Uint8Array>,
    private trans: Source<Uint8Array>,
    private plus: Source<Map<number, Palette>>,
    private tags: Source<PicTags>,
    private shadowsteps: number) {

    this.aCtx = ui.actionDescriptors().sub('arteditor');
    this.addActions();
    this.rasterizer = palRasterizer(pal.get());
    this.workplane = new Workplane(ui, this.createFrameRenderer(), this.createGridRenderer(), this.createCenterRenderer(), this.createImageInfoRenderer());
    this.workplane.scale = 2.5;
    this.drawPanel = createDrawPanel(this.rasterizer, this.rasterProvider, this.createBrowser(), id => this.select(id), () => this.pics());
    this.drawPanel.setCellSize(100, 100);
    new ResizeObserver(e => this.resize(<HTMLCanvasElement>e[0].target)).observe(this.drawPanel.canvas.cast());

    const searchBar = suggestedTextBox(ui, this.filter, s => this.oracle(s), Optional.of('magnifying-glass'), Optional.of(`Press '/'`));
    searchBar.asWidget().mod(style.width('200px'));
    this.actions.push(this.aCtx.bindSync('search', () => searchBar.focus()));

    const browser = ui.block().mod(e => e.style.position = 'relative').append(this.drawPanel.canvas);
    const builder = new WindowBuilder()
      .title(ui.block().text('ART Editor'))
      .size(1000, 665)
      .minSize(600, 600)
      .content(ui.column()
        .widget(ui.row(['window-toolbar'])
          .insert(this.createPalSelectingMenu())
          .insert(this.createShadowLevels())
          .insert(this.gridControl())
          .insert(ui.block(), '1')
          .widget(searchBar)
        )
        .widget(ui.row(['padded-5h'])
          .insert(this.createInfoBox())
          .widget(this.workplane, '1')
          .resizable(browser, 400, 200, 600),
          '1')
        .asWidget())
      .actions(this.actions);
    this.window = ui.createWindow(builder);

    this.filter.subscribe(() => this.updateFilter());
    let animHandle = -1;
    handle(null, (p, mainFrame) => {
      this.animationFrame.set(0);
      if (animHandle != -1) clearTimeout(animHandle);
      if (mainFrame.attrs.frames == 0) return;
      const speed = Math.pow(2, mainFrame.attrs.speed) * 10;
      animHandle = window.setInterval(() => this.animationFrame.set(this.animationFrame.get() + 1), speed);
      p.subscribe(() => { if (animHandle != -1) clearTimeout(animHandle) });
    }, this.mainFrameInfo);

    this.actions.push(this.aCtx.bindSync('toggle-repeat', () => this.repeat.set(!this.repeat.get())));
    this.actions.push(this.aCtx.bindSync('toggle-scale', () => this.superSample.set(!this.superSample.get())));
  }

  private addActions() {
    this.actions.push(this.aCtx.bindSync('next', () => this.drawPanel.scroll(1, ScrollType.ROW)));
    this.actions.push(this.aCtx.bindSync('prev', () => this.drawPanel.scroll(-1, ScrollType.ROW)));
  }

  private createFrameRenderer(): WorkplaneRendererBuilder {
    return (canvas, wctx) => {
      this.actions.push(this.aCtx.bindSync('center', () => this.centerPic()));
      this.centerPic = () => {
        const info = this.currentFrameInfo.get();
        wctx.xoff = canvas.width / 2 + info.attrs.xoff * wctx.scale;
        wctx.yoff = canvas.height / 2 + info.attrs.yoff * wctx.scale;
        this.workplane.redraw();
      }
      const cache = createImageDataCache();
      const renderer = () => {
        if (canvas.width == 0 || canvas.height == 0) return;
        const info = this.currentFrameInfo.get();
        const raster = transform(art(info), this.pluProvider.get());
        const ctx = canvas.getContext('2d');
        const w = raster.width * wctx.scale;
        const h = raster.height * wctx.scale;
        const xoff = -wctx.xoff + (int(info.w / 2) + info.attrs.xoff) * wctx.scale
        const yoff = -wctx.yoff + (int(info.h / 2) + info.attrs.yoff) * wctx.scale
        const scaled = !this.superSample.get()
          ? superResize(raster, w, h, this.closeBlend, this.blend)
          : resize(raster, w, h);
        const framed = this.repeat.get()
          ? rectRepeat(scaled, xoff, yoff, canvas.width + xoff, canvas.height + yoff)
          : rect(scaled, xoff, yoff, canvas.width + xoff, canvas.height + yoff, 0);
        const id = cache(canvas.width, canvas.height);
        id.data.fill(0);
        this.rasterizer(framed, id.data);
        ctx.putImageData(id, 0, 0);
      }
      handle(null, (p, frameInfo, supersample, plu, repeat) => renderer(), this.currentFrameInfo, this.superSample, this.pluProvider, this.repeat);
      return renderer;
    }
  }

  private createGridRenderer(): WorkplaneRendererBuilder {
    return (canvas, ctx) => {
      const renderer = () => renderGrid(canvas, ctx, this.gridSize.get(), this.gridSize.get() * this.gridSize.get());
      this.gridSize.subscribe(_ => renderer());
      return renderer;
    }
  }

  private createCenterRenderer(): WorkplaneRendererBuilder {
    return (canvas, wctx) => {
      return () => {
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'white';
        ctx.fillRect(-2 + wctx.xoff, -2 + wctx.yoff, 4, 4);
      }
    }
  }

  private createImageInfoRenderer(): WorkplaneRendererBuilder {
    let lastW = 0;
    let lastH = 0;
    return (canvas, wctx) => {
      const renderer = () => {
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        if (lastW == w && lastH == h) return;
        lastW = w;
        lastH = h;
        ctx.clearRect(0, 0, w, h);

        const pal = this.pal.get();
        const plu = this.pluProvider.get();
        const info = this.currentFrameInfo.get();
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
      handle(null, (p, frameInfo, plu) => { lastW = 0; renderer() }, this.currentFrameInfo, this.pluProvider);
      return renderer;
    }
  }

  private createInfoBox(): Block {
    const width = this.ui.block();
    const height = this.ui.block();
    const anim = this.ui.block();
    const props1 = [
      [widgetProp('Width', width), widgetProp('Height', height)],
      [widgetProp('Anim', anim)]
    ]
    handle(null, (p, info) => {
      width.text(`${info.w}px`);
      height.text(`${info.h}px`);
      anim.text(`${info.attrs.frames}`);
    }, this.currentFrameInfo);
    return props(this.ui, props1);
  }


  resize(e: HTMLCanvasElement): void {
    const w = e.clientWidth;
    const h = e.clientHeight;
    if (e.width != w) e.width = w;
    if (e.height != h) e.height = h;
    this.drawPanel.draw();
    this.centerPic();
  }

  stop() { this.window.destroy() }

  private blendColors(l: number, r: number, doff: number) {
    if (l != 255 && r != 255) return this.trans.get()[l * 256 + r];
    else return doff >= 0.5 ? l : r;
  }

  private createPalSelectingMenu() {
    const toggler = cyclicToggler([...this.plus.get().keys()], this.currentPlu.get());
    this.currentPlu.subscribe(plu => toggler.set(plu));
    this.actions.push(this.aCtx.bindSync('next-plu', () => this.currentPlu.set(toggler.toggleNext())));
    this.actions.push(this.aCtx.bindSync('prev-plu', () => this.currentPlu.set(toggler.togglePrev())));
    this.actions.push(this.aCtx.bindSync('reset-plu', () => this.currentPlu.set(0)));
    const menu = listBuilder(this.ui, this.currentPlu)
      .items(this.plus.get().keys())
      .renderer(i => this.plus.get().get(i).name)
      .labelPrefix('Palette: ')
      .labelMod(style.width('120px'))
      .build()
    return menu;
  }

  private gridControl() {
    const sizes = [0, 4, 8, 16, 32, 64, 128, 256];
    const sizesToggler = cyclicToggler(sizes, this.gridSize.get());
    this.gridSize.subscribe(value => sizesToggler.set(value));
    const box = listBuilder(this.ui, this.gridSize)
      .items(sizes)
      .renderer(s => s == 0 ? 'None' : `${s}px`)
      .labelPrefix('Grid: ')
      .labelMod(style.width('70px'))
      .build();
    this.actions.push(this.aCtx.bindSync('grid', blockActions.click(box)));
    this.actions.push(this.aCtx.bindSync('grid-inc', () => this.gridSize.set(sizesToggler.toggleNext())));
    this.actions.push(this.aCtx.bindSync('grid-dec', () => this.gridSize.set(sizesToggler.togglePrev())));
    return box;
  }

  private createShadowLevels() {
    return numberBox(this.ui, this.currentShadow, new NumberModelBuilder(INT_MODEL).range(0, 63).build(), Optional.of('120px'), Optional.of('Shadow: '));
  }

  private oracle(s: string): Iterable<ActionsWidget> {
    const str = s.toLowerCase();
    return iter(this.tags.get().allTags())
      .filter(t => t.toLowerCase().startsWith(str))
      .map(t => singleActionWidget(this.ui.block().text(t), async () => this.filter.set(t)));
  }

  private updateFilter() {
    this.drawPanel.scrollToId(this.currentId.get());
    this.drawPanel.draw();
  }

  private applyFilter(id: number): boolean {
    const filter = this.filter.get().toLowerCase();
    const dim = Number.parseInt(filter);
    if (!Number.isNaN(dim) && this.arts(id).get().map(i => i.h == dim || i.w == dim).orElse(false)) return true;
    if (filter.startsWith('*')) return (id + '').includes(filter.substring(1))
    return (id + '').startsWith(filter) || iter(this.tags.get().tags(id)).any(t => t.toLowerCase().includes(filter));
  }

  private pics(): Iterable<number> {
    return iter(range(0, 10 * 1024)).filter(i => this.applyFilter(i));
  }

  private createBrowser(): Block {
    const browserCanvas = this.ui.tag('canvas').mod(e => {
      const canvas = <HTMLCanvasElement>e;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.position = 'absolute';
    });
    return browserCanvas;
  }


  private select(id: number) {
    this.drawPanel.deselectAll();
    this.drawPanel.select(id);
    const info = this.arts(id).get();
    info.ifPresent(a => iter(range(0, a.attrs.frames + 1)).forEach(i => this.drawPanel.select(id + i)));
    this.drawPanel.draw();
    this.currentId.set(id);
    this.centerPic();
  }

  show() {
    this.ui.showWindow(this.window);
    this.workplane.redraw();
    this.drawPanel.draw();
    this.centerPic();
  }
}
