import h from "stage0";
import tippy from "tippy.js";
import { ArtPixelProvider } from "../../build/artpixelprovider";
import { animate, ArtInfoProvider } from "../../build/formats/art";
import { enumerate, range } from "../../utils/collections";
import { drawToCanvas } from "../../utils/imgutils";
import { create, lifecycle, Module, plugin } from "../../utils/injector";
import { iter } from "../../utils/iter";
import { int } from "../../utils/mathutils";
import { resize } from "../../utils/pixelprovider";
import { DrawPanel, PixelDataProvider } from "../../utils/ui/drawpanel";
import { menuButton, search } from "../../utils/ui/renderers";
import { addDragController, div } from "../../utils/ui/ui";
import { ART } from "../apis/app";
import { BUS, busDisconnector } from "../apis/handler";
import { Ui, UI, Window } from "../apis/ui";
import { namedMessageHandler } from "../edit/messages";
import { PicNumCallback } from "../edit/tools/selection";
import { Palette, PicTags, PIC_TAGS, RAW_PAL, RAW_PLUs } from "./artselector";
import { SHADOWSTEPS } from "./gl/buildgl";

function createDrawPanel(arts: ArtInfoProvider, pal: Uint8Array, plu: (x: number) => number, canvas: HTMLCanvasElement, cb: PicNumCallback, iter: () => Iterable<number>) {
  const provider = new PixelDataProvider(1024 * 10, (i: number) => {
    const info = arts.getInfo(i);
    return info == null
      ? null
      : new ArtPixelProvider(info, pal, plu);
  });
  return new DrawPanel(canvas, iter, provider, cb);
}

export async function ArtEditorModule(module: Module) {
  module.bind(plugin('ArtEditor'), lifecycle(async (injector, lifecycle) => {
    const bus = await injector.getInstance(BUS);
    const editor = await create(injector, ArtEditor, UI, ART, RAW_PAL, RAW_PLUs, PIC_TAGS, SHADOWSTEPS);
    lifecycle(bus.connect(namedMessageHandler('show_artedit', () => editor.show())), busDisconnector(bus));
    lifecycle(editor, async e => e.stop());
  }));
}

export class ArtEditor {
  private window: Window;
  private drawPanel: DrawPanel;
  private filter = "";
  private view: HTMLCanvasElement;
  private currentId = -1;
  private centerX = 320;
  private centerY = 320;
  private frame = 0;
  private animationHandle = -1;
  private scale = 2.0;
  private currentPlu = 0;
  private currentShadow = 0;
  private pluProvider = (x: number) => this.plus[this.currentPlu].plu[this.currentShadow * 256 + x];

  constructor(
    private ui: Ui,
    private arts: ArtInfoProvider,
    private pal: Uint8Array,
    private plus: Palette[],
    private tags: PicTags,
    private shadowsteps: number) {

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
        .endGroup()
        .widget(search('Search', s => this.oracle(s))))
      .build();
    this.window.hide();
  }

  public stop() { this.window.destroy() }

  private createPalSelectingMenu() {
    const menu = this.ui.builder.menu();
    iter(enumerate(this.plus)).forEach(([plu, i]) => menu.item(plu.name, () => { this.currentPlu = i; this.redraw() }))
    return menuButton('icon-adjust', menu);
  }

  private createShadowLevels() {
    const widgetTemplate = h`<div class="popup-widget">
      <label>Shadow Level</label>
      <input type="range" min="0" value="0" style="vertical-align: middle; margin-right:10px" #range>
      <input type="number" min="0" value="0" step="1" class="input-widget" #box>
    </div>`;
    const buttonTemplate = h`<button class="btn btn-default btn-dropdown">Shadow 0</button>`;
    const widget = <HTMLElement>widgetTemplate.cloneNode(true);
    const { range, box } = widgetTemplate.collect(widget);
    const btn = <HTMLElement>buttonTemplate.cloneNode(true);
    tippy(btn, {
      content: widget,
      allowHTML: true,
      placement: 'bottom-start',
      trigger: 'click',
      interactive: true,
      arrow: false,
      offset: [0, 0],
      duration: 100,
      appendTo: document.body
    });
    const setShadow = (shadow: number) => {
      this.currentShadow = shadow;
      range.value = shadow;
      box.value = shadow;
      btn.textContent = `Shadow ${shadow}`;
      this.redraw();
    }
    range.max = this.shadowsteps;
    box.max = this.shadowsteps;
    range.oninput = () => setShadow(range.value);
    box.oninput = () => setShadow(box.value);
    return btn;
  }

  private oracle(s: string) {
    this.updateFilter(s);
    return iter(this.tags.allTags())
      .filter(t => t.toLowerCase().startsWith(s.toLowerCase()));
  }

  private updateFilter(s: string) {
    this.filter = s;
    this.drawPanel.scrollToId(this.currentId);
    this.drawPanel.draw();
  }

  private applyFilter(id: number): boolean {
    const filter = this.filter.toLowerCase();
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
    this.currentId = id;
    this.resetAnimation();
    this.updateView();
  }

  private resetAnimation() {
    window.clearTimeout(this.animationHandle);
    this.animationHandle = -1;
    this.frame = 0;
  }

  private updateView(anim = true) {
    const ctx = this.view.getContext('2d');
    ctx.fillStyle = 'black';
    ctx.strokeStyle = 'white';
    ctx.fillRect(0, 0, this.view.clientWidth, this.view.clientHeight);

    const mainInfo = this.arts.getInfo(this.currentId);
    const frameInfo = this.arts.getInfo(this.currentId + animate(this.frame, mainInfo));
    if (mainInfo == null || frameInfo == null) return;
    const scaledW = int(frameInfo.w * this.scale);
    const scaledH = int(frameInfo.h * this.scale);
    const img = resize(new ArtPixelProvider(frameInfo, this.pal, this.pluProvider), scaledW, scaledH);
    const x = this.centerX - int(((frameInfo.attrs.xoff | 0) + frameInfo.w / 2) * this.scale);
    const y = this.centerY - int(((frameInfo.attrs.yoff | 0) + frameInfo.h / 2) * this.scale);
    drawToCanvas(img, ctx, x, y);

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
