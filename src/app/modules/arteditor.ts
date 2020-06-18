import { ArtInfoProvider, ArtInfo, NO_ANIMATION, OSCILLATING_ANIMATION, ANIMATE_FORWARD, ANIMATE_BACKWARD } from "../../build/formats/art";
import { range } from "../../utils/collections";
import { create, Dependency, Injector } from "../../utils/injector";
import { iter } from "../../utils/iter";
import { axisSwap, RGBPalPixelProvider, BlendAlpha } from "../../utils/pixelprovider";
import { DrawPanel, PixelDataProvider } from "../../utils/ui/drawpanel";
import { IconTextRenderer, menuButton, renderGrid, search, SerachBar, sugggestionsMenu } from "../../utils/ui/renderers";
import { Element, div } from "../../utils/ui/ui";
import { ART } from "../apis/app";
import { Ui, UI, Window } from "../apis/ui";
import { PicNumCallback } from "../edit/tools/selection";
import { PicTags, RAW_PAL, PIC_TAGS } from "./artselector";
import { RAW_PLUs } from "./blood/module";
import { BUS } from "../apis/handler";
import { namedMessageHandler } from "../edit/messages";
import { drawToCanvas } from "../../utils/imgutils";
import { int, cyclic } from "../../utils/mathutils";

function createDrawPanel(arts: ArtInfoProvider, pal: Uint8Array, canvas: HTMLCanvasElement, cb: PicNumCallback, iter: () => Iterable<number>) {
  const provider = new PixelDataProvider(1024 * 10, (i: number) => {
    const info = arts.getInfo(i);
    if (info == null) return null;
    return axisSwap(new RGBPalPixelProvider(info.img, pal, info.h, info.w, 255, 255));
  });
  return new DrawPanel(canvas, iter, provider, cb);
}

export async function ArtEditorModule(injector: Injector) {
  const bus = await injector.getInstance(BUS);
  const editor = await create(injector, ArtEditor, UI, ART, RAW_PAL, RAW_PLUs, PIC_TAGS);
  bus.connect(namedMessageHandler('show_artedit', () => editor.show()));
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

  constructor(
    private ui: Ui,
    private arts: ArtInfoProvider,
    private pal: Uint8Array,
    private plus: Uint8Array[],
    private tags: PicTags) {

    this.searchWidget = search('Search', s => { this.updateFilter(s); this.updateSuggestions(s) });
    const browserCanvas = document.createElement('canvas');
    browserCanvas.width = 640;
    browserCanvas.height = 64;
    browserCanvas.style.display = 'block';
    this.view = this.createView();
    this.window = ui.builder.windowBuilder()
      .title('ART Edit')
      .draggable(true)
      .closeable(true)
      .centered(true)
      .size(640, 640)
      .content(div('').css('overflow', 'hidden')
        .appendHtml(browserCanvas)
        .appendHtml(this.view)
        .elem())
      .toolbar(ui.builder.toolbarBuilder()
        .widget(this.searchWidget.widget))
      .build();

    this.drawPanel = createDrawPanel(arts, pal, browserCanvas, (id: number) => this.select(id), () => this.pics());
    this.window.hide();
  }

  private updateSuggestions(s: string) {
    const menu = iter(this.tags.allTags())
      .filter(t => t.toLowerCase().startsWith(s.toLowerCase()))
      .map(t => <[string, () => void]>[t, () => { this.searchWidget.setValue(t); this.updateFilter(t) }]);
    this.searchWidget.updateSuggestions(sugggestionsMenu(menu));
  }

  private updateFilter(s: string) {
    this.filter = s;
    this.drawPanel.seOffset(0);
    this.drawPanel.draw();
  }

  private applyFilter(id: number): boolean {
    const tags = iter(this.tags.tags(id));
    if (this.filter.startsWith('*')) return (id + '').includes(this.filter.substr(1))
    return (id + '').startsWith(this.filter) || tags.any(t => t.toLowerCase() == this.filter.toLowerCase());
  }

  private pics(): Iterable<number> {
    return iter(range(0, 10 * 1024)).filter(i => this.applyFilter(i));
  }

  private createView(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 640 - 64;
    return canvas;
  }

  private select(id: number) {
    this.drawPanel.deselectAll();
    this.drawPanel.select(id);
    this.drawPanel.draw();
    window.clearTimeout(this.animation);
    this.animation = -1;
    this.currentId = id;
    this.frame = 0;
    this.centerX = int(this.view.clientWidth / 2);
    this.centerY = int(this.view.clientHeight / 2);
    this.updateView();

    // ctx.beginPath();
    // ctx.setLineDash([4, 2]);
    // ctx.moveTo(0, y + info.h - info.attrs.yoff + 0.5);
    // ctx.lineTo(this.view.clientWidth, y + info.h - info.attrs.yoff + 0.5);
    // ctx.moveTo(x + int(info.w / 2) + info.attrs.xoff + 0.5, 0);
    // ctx.lineTo(x + int(info.w / 2) + info.attrs.xoff + 0.5, this.view.clientHeight);
    // ctx.stroke();
  }

  private updateView() {
    const ctx = this.view.getContext('2d');
    ctx.fillStyle = 'black';
    ctx.strokeStyle = 'white';
    ctx.fillRect(0, 0, this.view.clientWidth, this.view.clientHeight);

    const mainInfo = this.arts.getInfo(this.currentId);
    const frameInfo = this.arts.getInfo(this.currentId + this.getFrame(mainInfo));
    if (mainInfo == null || frameInfo == null) return;
    const img = axisSwap(new RGBPalPixelProvider(frameInfo.img, this.pal, frameInfo.h, frameInfo.w, 255, 255, 255, new Uint8Array([0, 0, 0, 255])));
    const x = this.centerX - (frameInfo.attrs.xoff | 0) - int(frameInfo.w / 2);
    const y = this.centerY - (frameInfo.attrs.yoff | 0) - int(frameInfo.h / 2);
    drawToCanvas(img, ctx, x, y);

    if ((mainInfo.attrs.frames | 0) != 0) {
      this.frame++;
      this.animation = window.setTimeout(() => this.updateView(), mainInfo.attrs.speed * 100);
    }
  }

  private getFrame(info: ArtInfo): number {
    const max = info.attrs.frames + 1;
    if (info.attrs.type == NO_ANIMATION) return 0;
    else if (info.attrs.type = OSCILLATING_ANIMATION) {
      const x = this.frame % (max * 2 - 2);
      return x >= max ? max * 2 - 2 - x : x;
    } else if (info.attrs.type == ANIMATE_FORWARD) return this.frame % max;
    else if (info.attrs.type == ANIMATE_BACKWARD) return max - this.frame % max;
  }

  public show() {
    this.window.show();
    this.drawPanel.draw();
  }
}
