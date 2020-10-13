import { ArtPixelProvider } from "../../build/artpixelprovider";
import { animate, ArtInfoProvider } from "../../build/formats/art";
import { range } from "../../utils/collections";
import { drawToCanvas } from "../../utils/imgutils";
import { create, Module } from "../../utils/injector";
import { iter } from "../../utils/iter";
import { int } from "../../utils/mathutils";
import { resize } from "../../utils/pixelprovider";
import { DrawPanel, PixelDataProvider } from "../../utils/ui/drawpanel";
import { menuButton, search, SerachBar, sugggestionsMenu } from "../../utils/ui/renderers";
import { div } from "../../utils/ui/ui";
import { ART } from "../apis/app";
import { BUS } from "../apis/handler";
import { Ui, UI, Window } from "../apis/ui";
import { namedMessageHandler } from "../edit/messages";
import { PicNumCallback } from "../edit/tools/selection";
import { PicTags, PIC_TAGS, RAW_PAL, RAW_PLUs } from "./artselector";

function createDrawPanel(arts: ArtInfoProvider, pal: Uint8Array, plu: (x: number) => number, canvas: HTMLCanvasElement, cb: PicNumCallback, iter: () => Iterable<number>) {
  const provider = new PixelDataProvider(1024 * 10, (i: number) => {
    const info = arts.getInfo(i);
    if (info == null) return null;
    return new ArtPixelProvider(info, pal, plu);
  });
  return new DrawPanel(canvas, iter, provider, cb);
}

export async function ArtEditorModule(module: Module) {
  module.execute(async injector => {
    const bus = await injector.getInstance(BUS);
    const editor = await create(injector, ArtEditor, UI, ART, RAW_PAL, RAW_PLUs, PIC_TAGS);
    bus.connect(namedMessageHandler('show_artedit', () => editor.show()));
  });
}

export class ArtEditor {
  private window: Window;
  private drawPanel: DrawPanel;
  private filter = "";
  private view: HTMLCanvasElement;
  private searchWidget: SerachBar;
  private currentId = -1;
  private centerX = 320;
  private centerY = 320;
  private frame = 0;
  private animation = -1;
  private scale = 2.0;
  private currentPlu = 0;
  private pluProvider = (x: number) => this.plus[this.currentPlu][x];

  constructor(
    private ui: Ui,
    private arts: ArtInfoProvider,
    private pal: Uint8Array,
    private plus: Uint8Array[],
    private tags: PicTags) {

    this.searchWidget = search('Search', s => { this.updateFilter(s); this.updateSuggestions(s) });
    const browserCanvas = document.createElement('canvas');
    browserCanvas.width = 640;
    browserCanvas.height = 192;
    browserCanvas.style.display = 'block';
    this.view = this.createView();
    this.window = ui.builder.window()
      .title('ART Edit')
      .draggable(true)
      .closeable(true)
      .centered(true)
      .size(640, 640)
      .content(div('')
        .appendHtml(this.view)
        .appendHtml(browserCanvas)
        .elem())
      .toolbar(ui.builder.toolbar()
        .widget(this.createPalSelectingMenu())
        .widget(this.searchWidget.widget))
      .build();

    this.drawPanel = createDrawPanel(arts, pal, this.pluProvider, browserCanvas, (id: number) => this.select(id), () => this.pics());
    this.window.hide();
  }

  private createPalSelectingMenu() {
    const menu = this.ui.builder.menu();
    iter(range(0, this.plus.length)).forEach(i => menu.item(i + '', () => { this.currentPlu = i; this.redraw() }))
    return menuButton('icon-adjust', menu);
  }

  private updateSuggestions(s: string) {
    const menu = iter(this.tags.allTags())
      .filter(t => t.toLowerCase().startsWith(s.toLowerCase()))
      .map(t => <[string, () => void]>[t, () => { this.searchWidget.setValue(t); this.updateFilter(t) }]);
    this.searchWidget.updateSuggestions(sugggestionsMenu(menu));
  }

  private updateFilter(s: string) {
    this.filter = s;
    this.drawPanel.scrollToId(this.currentId);
    this.drawPanel.draw();
  }

  private applyFilter(id: number): boolean {
    if (this.filter.startsWith('*')) return (id + '').includes(this.filter.substr(1))
    return (id + '').startsWith(this.filter) || iter(this.tags.tags(id)).any(t => t.toLowerCase() == this.filter.toLowerCase());
  }

  private pics(): Iterable<number> {
    return iter(range(0, 10 * 1024)).filter(i => this.applyFilter(i));
  }

  private createView(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 640 - 192;
    canvas.style.display = 'block';
    canvas.addEventListener('wheel', e => {
      if (e.deltaY > 0) this.scale *= 0.9;
      if (e.deltaY < 0) this.scale *= 1.1;
      this.updateView(false);
    });
    let isDrag = false;
    let oldx = 0;
    let oldy = 0;
    canvas.addEventListener('mousemove', e => {
      if (isDrag) {
        const dx = e.x - oldx;
        const dy = e.y - oldy;
        if (dx != 0 || dy != 0) {
          this.centerX += dx;
          this.centerY += dy;
          this.updateView(false);
        }
      }
      oldx = e.x;
      oldy = e.y;
    });
    canvas.addEventListener('mousedown', e => isDrag = true);
    canvas.addEventListener('mouseup', e => isDrag = false);
    return canvas;
  }

  private select(id: number) {
    this.drawPanel.deselectAll();
    this.drawPanel.select(id);
    const info = this.arts.getInfo(id);
    if (info != null && info.attrs.frames) iter(range(0, info.attrs.frames + 1)).forEach(i => this.drawPanel.select(id + i));
    this.drawPanel.draw();
    this.currentId = id;
    this.resetAnimation();
    this.updateView();
  }

  private resetAnimation() {
    window.clearTimeout(this.animation);
    this.animation = -1;
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
      this.animation = window.setTimeout(() => this.updateView(), mainInfo.attrs.speed * 50);
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
