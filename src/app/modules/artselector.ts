import { art } from "../../build/artraster";
import { ArtInfoProvider } from "../../build/formats/art";
import { value } from "../../utils/callbacks";
import { range } from "../../utils/collections";
import { create, Dependency, lifecycle } from "../../utils/injector";
import { iter } from "../../utils/iter";
import { palRasterizer } from "../../utils/pixelprovider";
import { listBox } from "../../utils/ui/controls/listbox";
import { DrawPanel } from "../../utils/ui/drawpanel";
import { menuButton } from "../../utils/ui/renderers";
import { ART } from "../apis/app";
import { Ui, UI, Window } from "../apis/ui";
import { PicNumCallback } from "../edit/tools/selection";

function createDrawPanel(arts: ArtInfoProvider, pal: Uint8Array, canvas: HTMLCanvasElement, cb: PicNumCallback, iter: () => Iterable<number>) {
  const provider = (i: number) => {
    const info = arts.getInfo(i);
    return info == null ? null : art(info);
  };
  const rasterizer = palRasterizer(pal);
  return new DrawPanel(canvas, iter, provider, rasterizer, 0, cb);
}


export interface PicTags {
  allTags(): Iterable<string>;
  tags(picnum: number): Iterable<string>;
}

export type Palette = { readonly name: string, readonly plu: Uint8Array }

export const RAW_PAL = new Dependency<Uint8Array>('RawPal');
export const RAW_PLUs = new Dependency<Palette[]>('Raw PLUs');
export const PIC_TAGS = new Dependency<PicTags>('Tags');
export const TRANS_TABLE = new Dependency<Uint8Array>('Trans Table');

export const SelectorConstructor = lifecycle(async (injector, lifecycle) => {
  const selector = await create(injector, Selector, UI, ART, RAW_PAL, PIC_TAGS);
  lifecycle(selector, async s => s.stop());
  return (cb: PicNumCallback) => selector.modal(cb);
});


export class Selector {
  private window: Window;
  private drawPanel: DrawPanel<number>;
  private cb: PicNumCallback;
  private filter = value("");

  constructor(private ui: Ui, arts: ArtInfoProvider, pal: Uint8Array, private tags: PicTags) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 640;
    this.window = ui.builder.window()
      .title('Tiles')
      .draggable(true)
      .closeable(true)
      .centered(true)
      .size(640, 640)
      .toolbar(ui.builder.toolbar()
        .widget(menuButton('icon-popup', ui.builder.menu()
          .item('32', () => { this.drawPanel.setCellSize(32, 32) })
          .item('64', () => { this.drawPanel.setCellSize(64, 64) })
          .item('128', () => { this.drawPanel.setCellSize(128, 128) })))
        .widget(listBox('Search', 'icon-search', s => this.oracle(s), this.filter, true))
      )
      .onclose(() => this.select(-1))
      .content(canvas)
      .build();

    this.filter.add(() => this.updateFilter());
    this.drawPanel = createDrawPanel(arts, pal, canvas, (id: number) => this.select(id), () => this.pics());
    this.hide();
  }

  public stop() { this.window.destroy() }

  private updateFilter() {
    this.drawPanel.seOffset(0);
    this.drawPanel.draw();
  }

  private oracle(s: string) {
    return iter(this.tags.allTags())
      .filter(t => t.toLowerCase().startsWith(s.toLowerCase()));
  }

  private applyFilter(id: number): boolean {
    const tags = iter(this.tags.tags(id));
    const filter = this.filter.get().toLowerCase();
    if (filter.startsWith('*')) return (id + '').includes(filter.substr(1))
    return (id + '').startsWith(filter) || tags.any(t => t.toLowerCase() == filter);
  }

  private pics(): Iterable<number> {
    return iter(range(0, 10 * 1024)).filter(i => this.applyFilter(i));
  }

  public show() {
    this.window.setPosition('50%', '50%');
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