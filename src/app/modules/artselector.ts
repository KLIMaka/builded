import { axisSwap, RGBPalPixelProvider } from "../../utils/pixelprovider";
import { DrawPanel, PixelDataProvider } from "../../utils/ui/drawpanel";
import { dragElement } from "../../utils/ui/ui";
import { ArtInfoProvider } from "../../build/formats/art";
import { Injector, Dependency } from "../../utils/injector";
import { ART } from "../apis/app";
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
  return Promise.all([
    injector.getInstance(ART),
    injector.getInstance(RAW_PAL)])
    .then(([art, pal]) => {
      const selector = new Selector(art, pal)
      return (cb: PicNumCallback) => selector.modal(cb);
    });
}

export class Selector {
  private panel: HTMLElement;
  private drawPanel: DrawPanel;
  private cb: PicNumCallback;

  constructor(arts: ArtInfoProvider, pal: Uint8Array) {
    this.panel = document.getElementById('select_tile');

    document.getElementById('select_tile_left').onclick = () => { this.drawPanel.prevPage(); this.drawPanel.draw(); };
    document.getElementById('select_tile_right').onclick = () => { this.drawPanel.nextPage(); this.drawPanel.draw(); };
    document.getElementById('select_tile_close').onclick = () => this.select(-1);

    const canvas = <HTMLCanvasElement>document.getElementById('select_tile_canvas');
    this.drawPanel = createDrawPanel(arts, pal, canvas, (id: number) => this.select(id));
    this.drawPanel.setCellSize(64, 64);
    this.hide();
    dragElement(document.getElementById('select_tile_title'), this.panel);
  }

  public show() {
    this.panel.style.setProperty('display', 'block');
    this.drawPanel.draw();
  }

  public hide() {
    this.panel.style.setProperty('display', 'none');
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