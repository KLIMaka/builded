import { art } from "../../build/artraster";
import { animate, ArtInfoProvider } from "../../build/formats/art";
import { transformed, tuple, value } from "../../utils/callbacks";
import { enumerate, range } from "../../utils/collections";
import { drawToCanvas } from "../../utils/imgutils";
import { create, lifecycle, Module, plugin } from "../../utils/injector";
import { iter } from "../../utils/iter";
import { int } from "../../utils/mathutils";
import { palRasterizer, Rasterizer, rect, resize, superResize, transform } from "../../utils/pixelprovider";
import { DrawPanel, RasterProvider } from "../../utils/ui/drawpanel";
import { menuButton, search, sliderToolbarButton, ValueHandleImpl } from "../../utils/ui/renderers";
import { addDragController, div } from "../../utils/ui/ui";
import { intValue, numberRangeValidator } from "../../utils/value";
import { ART } from "../apis/app";
import { BUS, busDisconnector } from "../apis/handler";
import { Ui, UI, Window } from "../apis/ui";
import { namedMessageHandler } from "../edit/messages";
import { PicNumCallback } from "../edit/tools/selection";
import { Palette, PicTags, PIC_TAGS, RAW_PAL, RAW_PLUs, TRANS_TABLE } from "./artselector";
import { SHADOWSTEPS } from "./gl/buildgl";

function createDrawPanel(arts: ArtInfoProvider, pal: Uint8Array, plu: (x: number) => number, canvas: HTMLCanvasElement, cb: PicNumCallback, iter: () => Iterable<number>) {
  const provider = new RasterProvider(1024 * 10, (i: number) => {
    const info = arts.getInfo(i);
    return info == null ? null : transform(art(info), plu);
  });
  const rasterizer = palRasterizer(pal);
  return new DrawPanel(canvas, iter, provider, rasterizer, 0, cb);
}

export async function ArtEditorModule(module: Module) {
  module.bind(plugin('ArtEditor'), lifecycle(async (injector, lifecycle) => {
    const bus = await injector.getInstance(BUS);
    const editor = await create(injector, ArtEditor, UI, ART, RAW_PAL, TRANS_TABLE, RAW_PLUs, PIC_TAGS, SHADOWSTEPS);
    lifecycle(bus.connect(namedMessageHandler('show_artedit', () => editor.show())), busDisconnector(bus));
    lifecycle(editor, async e => e.stop());
  }));
}

export class ArtEditor {
  private window: Window;
  private drawPanel: DrawPanel<number>;
  private filter = value("");
  private view: HTMLCanvasElement;
  private currentId = value(0);
  private mainFrameInfo = transformed(this.currentId, id => this.arts.getInfo(id));
  private animationFrame = value(0);
  private currentFrameInfo = transformed(tuple(this.currentId, this.animationFrame), ([id, frame]) => this.arts.getInfo(id + animate(frame, this.arts.getInfo(id))))

  private centerX = value(320);
  private centerY = value(320);
  private scale = value(2.0);
  private animationHandle = -1;
  private currentPlu = value(0);
  private currentShadow = value(0);
  private superSample = value(true);
  private pluProvider = (x: number) => (x >= 255 || x < 0) ? 255 : this.plus[this.currentPlu.get()].plu[this.currentShadow.get() * 256 + x];
  private rasterizer: Rasterizer<number>;
  private closeBlend = (l: number, r: number, doff: number) => Math.abs(l - r) <= 4 ? this.blendColors(l, r, doff) : null;
  private blend = (l: number, r: number, doff: number) => this.blendColors(l, r, doff);

  constructor(
    private ui: Ui,
    private arts: ArtInfoProvider,
    private pal: Uint8Array,
    private trans: Uint8Array,
    private plus: Palette[],
    private tags: PicTags,
    private shadowsteps: number) {

    this.rasterizer = palRasterizer(pal);
    this.drawPanel = createDrawPanel(arts, pal, this.pluProvider, this.createBrowser(), (id: number) => this.select(id), () => this.pics());
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
        .iconButton('icon-adjust', () => { this.superSample = !this.superSample; this.updateView(false) })
        .endGroup()
        .widget(search('Search', 'icon-search', s => this.oracle(s), this.filter, true)))
      .build();

    this.filter.add(_ => this.updateFilter());
    this.currentShadow.add(_ => this.redraw());
  }

  public stop() { this.window.destroy() }

  private blendColors(l: number, r: number, doff: number) {
    if (l != 255 && r != 255) return this.trans[l * 256 + r];
    else return doff >= 0.5 ? l : r;
  }

  private createPalSelectingMenu() {
    const menu = this.ui.builder.menu();
    iter(enumerate(this.plus)).forEach(([plu, i]) => menu.item(plu.name, () => { this.currentPlu = i; this.redraw() }))
    return menuButton('icon-adjust', menu);
  }

  private createShadowLevels() {
    return sliderToolbarButton({ label: "Shadow", handle: this.currentShadow, value: intValue(0, numberRangeValidator(0, this.shadowsteps)) });
  }

  private oracle(s: string) {
    return iter(this.tags.allTags())
      .filter(t => t.toLowerCase().startsWith(s.toLowerCase()));
  }

  private updateFilter() {
    this.drawPanel.scrollToId(this.currentId);
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
      this.centerX += dx;
      this.centerY += dy;
      this.scale *= dscale;
      this.updateView(false);
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

  private resetAnimation() {
    window.clearTimeout(this.animationHandle);
    this.animationHandle = -1;
    this.frame = 0;
  }

  private updateView(anim = true) {
    if (this.currentId < 0) return;

    const ctx = this.view.getContext('2d');
    ctx.fillStyle = 'black';
    ctx.strokeStyle = 'white';
    ctx.fillRect(0, 0, this.view.clientWidth, this.view.clientHeight);

    const mainInfo = this.arts.getInfo(this.currentId);
    const frameInfo = this.arts.getInfo(this.currentId + animate(this.frame, mainInfo));
    if (mainInfo == null || frameInfo == null) return;
    const scaledW = int(frameInfo.w * this.scale);
    const scaledH = int(frameInfo.h * this.scale);

    const plued = transform(art(frameInfo), this.pluProvider);
    const img = this.superSample
      ? superResize(plued, scaledW, scaledH, this.closeBlend, this.blend)
      : resize(plued, scaledW, scaledH);
    const x = this.centerX - int(((frameInfo.attrs.xoff | 0) + frameInfo.w / 2) * this.scale);
    const y = this.centerY - int(((frameInfo.attrs.yoff | 0) + frameInfo.h / 2) * this.scale);
    drawToCanvas(rect(img, - x, - y, this.view.width - x, this.view.height - y, 0), ctx, this.rasterizer);

    if (anim && (mainInfo.attrs.frames | 0) != 0) {
      this.frame++;
      this.animationHandle = window.setTimeout(() => this.updateView(), mainInfo.attrs.speed * 50);
    }
  }

  private redraw() {
    this.drawPanel.draw();
    this.updateView(false);
  }

  public show() {
    this.window.show();
    this.redraw();
  }
}
