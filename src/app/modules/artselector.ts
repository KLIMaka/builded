import { ArtInfoProvider } from "../../build/formats/art";
import { create, Dependency, Injector } from "../../utils/injector";
import { axisSwap, RGBPalPixelProvider } from "../../utils/pixelprovider";
import { DrawPanel, PixelDataProvider } from "../../utils/ui/drawpanel";
import { ART } from "../apis/app";
import { Ui, UI, Window } from "../apis/ui";
import { PicNumCallback } from "../edit/tools/selection";
import { iter } from "../../utils/iter";
import { range } from "../../utils/collections";

function createDrawPanel(arts: ArtInfoProvider, pal: Uint8Array, canvas: HTMLCanvasElement, cb: PicNumCallback, iter: () => Iterable<number>) {
  let provider = new PixelDataProvider(1024 * 10, (i: number) => {
    let info = arts.getInfo(i);
    if (info == null) return null;
    return axisSwap(new RGBPalPixelProvider(info.img, pal, info.h, info.w, 255, 255));
  });
  return new DrawPanel(canvas, iter, provider, cb);
}

export const RAW_PAL = new Dependency<Uint8Array>('RawPal');

export async function SelectorConstructor(injector: Injector) {
  const selector = await create(injector, Selector, UI, ART, RAW_PAL);
  return (cb: PicNumCallback) => selector.modal(cb);
}

export class Selector {
  private window: Window;
  private drawPanel: DrawPanel;
  private cb: PicNumCallback;
  private filter = "";

  constructor(ui: Ui, arts: ArtInfoProvider, pal: Uint8Array) {
    this.window = ui.builder.windowBuilder()
      .id('select_tile')
      .title('Tiles')
      .draggable(true)
      .closeable(true)
      .centered(true)
      .size(640, 640)
      .toolbar(ui.builder.toolbarBuilder()
        // .startGroup()
        // .button('icon-left-dir', () => { this.drawPanel.prevPage(); this.drawPanel.draw() })
        // .button('icon-right-dir', () => { this.drawPanel.nextPage(); this.drawPanel.draw() })
        // .endGroup()
        .search('Search', s => this.updateFilter(s))
      )
      .onclose(() => this.select(-1))
      .build();

    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 640;
    this.drawPanel = createDrawPanel(arts, pal, canvas, (id: number) => this.select(id), () => this.pics());
    this.window.contentElement.append(canvas);
    this.hide();
  }

  private updateFilter(s: string) {
    this.filter = s;
    this.drawPanel.seOffset(0);
    this.drawPanel.draw()
  }

  private searchFilter(id: number): boolean {
    if (this.filter.startsWith('*')) return (id + '').includes(this.filter.substr(1))
    return (id + '').startsWith(this.filter);
  }

  private pics(): Iterable<number> {
    return iter(range(0, 10 * 1024)).filter(i => this.searchFilter(i));
  }

  public show() {
    this.window.show();
    this.drawPanel.draw();
  }

  public hide() {
    this.window.hide();
  }


  public modal(cb: PicNumCallback) {
    this.cb = cb;
    this.show();
  }

  private select(id: number) {
    this.hide();
    if (this.cb == null) return;
    let cb = this.cb;
    this.cb = null;
    cb(id);
  }
}