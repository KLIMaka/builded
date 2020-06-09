import { ArtInfoProvider } from "../../build/formats/art";
import { create, Dependency, Injector } from "../../utils/injector";
import { axisSwap, RGBPalPixelProvider } from "../../utils/pixelprovider";
import { DrawPanel, PixelDataProvider } from "../../utils/ui/drawpanel";
import { ART } from "../apis/app";
import { Ui, UI, Window } from "../apis/ui";
import { PicNumCallback } from "../edit/tools/selection";

function createDrawPanel(arts: ArtInfoProvider, pal: Uint8Array, canvas: HTMLCanvasElement, cb: PicNumCallback) {
  let provider = new PixelDataProvider(1024 * 10, (i: number) => {
    let info = arts.getInfo(i);
    if (info == null) return null;
    return axisSwap(new RGBPalPixelProvider(info.img, pal, info.h, info.w));
  });
  return new DrawPanel(canvas, provider, cb);
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

  constructor(ui: Ui, arts: ArtInfoProvider, pal: Uint8Array) {
    this.window = ui.builder.windowBuilder()
      .id('select_tile')
      .title('Tiles')
      .draggable(true)
      .closeable(true)
      .centered(true)
      .size(640, 640)
      .toolbar('icon-left-dir', () => { this.drawPanel.prevPage(); this.drawPanel.draw() })
      .toolbar('icon-right-dir', () => { this.drawPanel.nextPage(); this.drawPanel.draw() })
      .onclose(() => this.select(-1))
      .build();

    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 640;
    this.drawPanel = createDrawPanel(arts, pal, canvas, (id: number) => this.select(id));
    this.drawPanel.setCellSize(64, 64);
    this.window.contentElement.append(canvas);
    this.window.hide();
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