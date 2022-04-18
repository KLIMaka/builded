import { art } from "../../build/artraster";
import { animate, ArtInfo, ArtInfoProvider, Attributes } from "../../build/formats/art";
import { CallbackChannel, handle, reference, Source, transformed, tuple, value } from "../../utils/callbacks";
import { enumerate, or, range } from "../../utils/collections";
import { drawToCanvas } from "../../utils/imgutils";
import { create, lifecycle, Module, plugin } from "../../utils/injector";
import { iter } from "../../utils/iter";
import { int } from "../../utils/mathutils";
import { palRasterizer, Raster, Rasterizer, rect, resize, superResize, transform } from "../../utils/pixelprovider";
import { listBox } from "../../utils/ui/controls/listbox";
import { DrawPanel } from "../../utils/ui/drawpanel";
import { menuButton, sliderToolbarButton } from "../../utils/ui/renderers";
import { addDragController, div } from "../../utils/ui/ui";
import { intValue, numberRangeValidator } from "../../utils/value";
import { ART } from "../apis/app";
import { BUS, busDisconnector } from "../apis/handler";
import { Ui, UI, Window } from "../apis/ui";
import { namedMessageHandler } from "../edit/messages";
import { PicNumCallback } from "../edit/tools/selection";
import { Palette, PicTags, PIC_TAGS, RAW_PAL, RAW_PLUs, TRANS_TABLE } from "./artselector";
import { SHADOWSTEPS } from "./gl/buildgl";

function createDrawPanel(rasterizer: Rasterizer<number>, rasterProvider: Source<(id: number) => Raster<number>> & CallbackChannel<[]>, canvas: HTMLCanvasElement, cb: PicNumCallback, iter: () => Iterable<number>) {
  const rasters = rasterProvider.get();
  const panel = new DrawPanel(canvas, iter, rasters, rasterizer, 0, cb);
  rasterProvider.add(() => panel.setSource(rasterProvider.get()));
  return panel;
}

export async function ArtEditorModule(module: Module) {
  module.bind(plugin('ArtEditor'), lifecycle(async (injector, lifecycle) => {
    const bus = await injector.getInstance(BUS);
    const editor = await create(injector, ArtEditor, UI, ART, RAW_PAL, TRANS_TABLE, RAW_PLUs, PIC_TAGS, SHADOWSTEPS);
    lifecycle(bus.connect(namedMessageHandler('show_artedit', () => editor.show())), busDisconnector(bus));
    lifecycle(editor, async e => e.stop());
  }));
}

const VOID_ART_INFO = new ArtInfo(0, 0, new Attributes(), new Uint8Array());

export class ArtEditor {
  private window: Window;
  private drawPanel: DrawPanel<number>;
  private view: HTMLCanvasElement;
  private filter = value("");
  private currentId = value(0);
  private currentPlu = value(0);
  private currentShadow = value(0);
  private animationFrame = value(0);
  private controls = reference({ x: 320, y: 320, scale: 2 });
  private superSample = value(true);
  private mainFrameInfo = transformed(this.currentId, id => or(this.arts.getInfo(id), VOID_ART_INFO));
  private currentFrameInfo = transformed(tuple(this.currentId, this.animationFrame, this.mainFrameInfo),
    ([id, frame, mainFrame]) => or(this.arts.getInfo(id + animate(frame, mainFrame)), VOID_ART_INFO));
  private pluProvider = transformed(tuple(this.currentShadow, this.currentPlu),
    ([shadow, plu]) => (x: number) => (x >= 255 || x < 0) ? 255 : this.plus[plu].plu[shadow * 256 + x]);
  private rasterProvider = transformed(this.pluProvider, plu => (i: number) => transform(art(or(this.arts.getInfo(i), VOID_ART_INFO)), plu));

  private closeBlend = (l: number, r: number, doff: number) => Math.abs(l - r) <= 4 ? this.blendColors(l, r, doff) : null;
  private blend = (l: number, r: number, doff: number) => this.blendColors(l, r, doff);
  private rasterizer: Rasterizer<number>;

  constructor(
    private ui: Ui,
    private arts: ArtInfoProvider,
    private pal: Uint8Array,
    private trans: Uint8Array,
    private plus: Palette[],
    private tags: PicTags,
    private shadowsteps: number) {

    this.rasterizer = palRasterizer(pal);
    this.drawPanel = createDrawPanel(this.rasterizer, this.rasterProvider, this.createBrowser(), id => this.select(id), () => this.pics());
    this.view = this.createView();
    this.window = ui.builder.window()
      .title('ART Edit')
      .draggable(true)
      .closeable(true)
      .centered(true)
      .size(640, 640)
      .content(div('')
        .appendHtml(this.view)
        .appendHtml(this.drawPanel.canvas)
        .elem())
      .toolbar(ui.builder.toolbar()
        .startGroup()
        .widget(this.createPalSelectingMenu())
        .widget(this.createShadowLevels())
        .iconButton('icon-adjust', () => { this.superSample.set(!this.superSample.get()) })
        .endGroup()
        .widget(listBox('Search', 'icon-search', s => this.oracle(s), this.filter, true)))
      .build();

    this.filter.add(() => this.updateFilter());

    let animHandle = -1;
    handle(null, (p, mainFrame) => {
      this.animationFrame.set(0);
      if (animHandle != -1) clearTimeout(animHandle);
      if (mainFrame.attrs.frames == 0) return;
      const speed = mainFrame.attrs.speed * 50;
      animHandle = window.setInterval(() => this.animationFrame.set(this.animationFrame.get() + 1), speed);
      p.add(() => { if (animHandle != -1) clearTimeout(animHandle) });
    }, this.mainFrameInfo);

    handle(null, (p, frameInfo, ctl, supersample, plu) => {
      const ctx = this.view.getContext('2d');
      ctx.fillStyle = 'black';
      ctx.strokeStyle = 'white';
      ctx.fillRect(0, 0, this.view.clientWidth, this.view.clientHeight);

      const scaledW = int(frameInfo.w * ctl.scale);
      const scaledH = int(frameInfo.h * ctl.scale);

      const plued = transform(art(frameInfo), plu);
      const img = supersample
        ? superResize(plued, scaledW, scaledH, this.closeBlend, this.blend)
        : resize(plued, scaledW, scaledH);
      const x = ctl.x - int(((frameInfo.attrs.xoff | 0) + frameInfo.w / 2) * ctl.scale);
      const y = ctl.y - int(((frameInfo.attrs.yoff | 0) + frameInfo.h / 2) * ctl.scale);
      drawToCanvas(rect(img, - x, - y, this.view.width - x, this.view.height - y, 0), ctx, this.rasterizer);
    }, this.currentFrameInfo, this.controls, this.superSample, this.pluProvider);
  }

  public stop() { this.window.destroy() }

  private blendColors(l: number, r: number, doff: number) {
    if (l != 255 && r != 255) return this.trans[l * 256 + r];
    else return doff >= 0.5 ? l : r;
  }

  private createPalSelectingMenu() {
    const menu = this.ui.builder.menu();
    iter(enumerate(this.plus)).forEach(([plu, i]) => menu.item(plu.name, () => { this.currentPlu.set(i) }))
    return menuButton('icon-adjust', menu);
  }

  private createShadowLevels() {
    return sliderToolbarButton({ label: "Shadow", handle: this.currentShadow, model: intValue(0, numberRangeValidator(0, this.shadowsteps)) });
  }

  private oracle(s: string) {
    const str = s.toLowerCase();
    return iter(this.tags.allTags())
      .filter(t => t.toLowerCase().startsWith(str));
  }

  private updateFilter() {
    this.drawPanel.scrollToId(this.currentId.get());
    this.drawPanel.draw();
  }

  private applyFilter(id: number): boolean {
    const filter = this.filter.get().toLowerCase();
    if (filter.startsWith('*')) return (id + '').includes(filter.substr(1))
    return (id + '').startsWith(filter) || iter(this.tags.tags(id)).any(t => t.toLowerCase().includes(filter));
  }

  private pics(): Iterable<number> {
    return iter(range(0, 10 * 1024)).filter(i => this.applyFilter(i));
  }

  private createBrowser(): HTMLCanvasElement {
    const browserCanvas = document.createElement('canvas');
    browserCanvas.width = 640;
    browserCanvas.height = 192;
    browserCanvas.style.display = 'block';
    return browserCanvas;
  }

  private createView(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 640 - 192;
    canvas.style.display = 'block';
    addDragController(canvas, (dx, dy, dscale) => {
      const ctl = this.controls.get();
      ctl.x += dx;
      ctl.y += dy;
      ctl.scale *= dscale;
      this.controls.modify();
    });
    return canvas;
  }

  private select(id: number) {
    this.drawPanel.deselectAll();
    this.drawPanel.select(id);
    const info = this.arts.getInfo(id);
    if (info != null && info.attrs.frames > 0) iter(range(0, info.attrs.frames + 1)).forEach(i => this.drawPanel.select(id + i));
    this.drawPanel.draw();
    this.currentId.set(id);
  }

  public show() {
    this.window.show();
    this.currentId.notify();
    this.drawPanel.draw();
  }
}
