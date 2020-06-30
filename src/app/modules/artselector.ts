import { ArtInfoProvider } from "../../build/formats/art";
import { range } from "../../utils/collections";
import { create, Dependency, Injector } from "../../utils/injector";
import { iter } from "../../utils/iter";
import { axisSwap, RGBPalPixelProvider } from "../../utils/pixelprovider";
import { DrawPanel, PixelDataProvider } from "../../utils/ui/drawpanel";
import { IconTextRenderer, menuButton, renderGrid, search, SerachBar, sugggestionsMenu } from "../../utils/ui/renderers";
import { Element } from "../../utils/ui/ui";
import { ART } from "../apis/app";
import { Ui, UI, Window } from "../apis/ui";
import { PicNumCallback } from "../edit/tools/selection";

function createDrawPanel(arts: ArtInfoProvider, pal: Uint8Array, canvas: HTMLCanvasElement, cb: PicNumCallback, iter: () => Iterable<number>) {
  let provider = new PixelDataProvider(1024 * 10, (i: number) => {
    let info = arts.getInfo(i);
    if (info == null) return null;
    return axisSwap(new RGBPalPixelProvider(info.img, pal, info.h, info.w, 255, 255));
  });
  return new DrawPanel(canvas, iter, provider, cb);
}

export interface PicTags {
  allTags(): Iterable<string>;
  tags(picnum: number): Iterable<string>;
}

export const RAW_PAL = new Dependency<Uint8Array>('RawPal');
export const RAW_PLUs = new Dependency<Uint8Array[]>('Raw PLUs');
export const PIC_TAGS = new Dependency<PicTags>('Tags');

export async function SelectorConstructor(injector: Injector) {
  const selector = await create(injector, Selector, UI, ART, RAW_PAL, PIC_TAGS);
  return (cb: PicNumCallback) => selector.modal(cb);
}

function createTagsGridModel(tags: PicTags) {
  const selected = new Set<string>();
  const columns = [IconTextRenderer];
  let callback: (selected: Iterable<string>) => void;
  const grid = {
    async rows() { return iter(tags.allTags()).map(s => [[s, selected.has(s)]]) },
    columns() { return columns },
    onClick(row: any[], rowElement: Element) {
      const value = row[0][0];
      if (selected.has(value)) selected.delete(value);
      else selected.add(value);
      rowElement.elem().classList.toggle('selected');
      if (callback) callback(selected.values());
    }
  }
  return {
    renderGrid() { return renderGrid(grid) },
    selected() { return selected },
    connect(cb: (selected: Iterable<string>) => void) { callback = cb }
  }
}

export class Selector {
  private window: Window;
  private drawPanel: DrawPanel;
  private cb: PicNumCallback;
  private filter = "";
  private searchWidget: SerachBar;
  // private selectedTags: string[] = [];

  constructor(private ui: Ui, arts: ArtInfoProvider, pal: Uint8Array, private tags: PicTags) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 640;
    // const grid = createTagsGridModel(tags);
    // const gridPanel = div('pane-sm sidebar').css('width', '170px');
    // grid.renderGrid().then(g => gridPanel.append(g));
    // grid.connect(tags => { this.selectedTags = [...tags], this.drawPanel.draw() });
    // const paneGroup = div('pane-group')
    //   .append(gridPanel)
    //   .append(div('pane').css('overflow', 'hidden').appendHtml(canvas));
    this.searchWidget = search('Search', s => { this.updateFilter(s); this.updateSuggestions(s) });
    this.window = ui.builder.windowBuilder()
      .id('select_tile')
      .title('Tiles')
      .draggable(true)
      .closeable(true)
      .centered(true)
      .size(640, 640)
      .toolbar(ui.builder.toolbarBuilder()
        .widget(menuButton('icon-popup', ui.builder.menuBuilder()
          .item('32', () => { this.drawPanel.setCellSize(32, 32) })
          .item('64', () => { this.drawPanel.setCellSize(64, 64) })
          .item('128', () => { this.drawPanel.setCellSize(128, 128) })))
        .widget(this.searchWidget.widget)
      )
      .onclose(() => this.select(-1))
      .content(canvas)
      .build();

    this.drawPanel = createDrawPanel(arts, pal, canvas, (id: number) => this.select(id), () => this.pics());
    this.drawPanel.select(110);
    this.drawPanel.select(111);
    this.hide();
  }

  private updateFilter(s: string) {
    this.filter = s;
    this.drawPanel.seOffset(0);
    this.drawPanel.draw();
  }

  private updateSuggestions(s: string) {
    const menu = iter(this.tags.allTags())
      .filter(t => t.toLowerCase().startsWith(s.toLowerCase()))
      .map(t => <[string, () => void]>[t, () => { this.searchWidget.setValue(t); this.updateFilter(t) }]);
    this.searchWidget.updateSuggestions(sugggestionsMenu(menu));
  }

  private applyFilter(id: number): boolean {
    const tags = iter(this.tags.tags(id));
    // if (!tags.isEmpty() && !tags.any(t => this.selectedTags.includes(t))) return false;
    if (this.filter.startsWith('*')) return (id + '').includes(this.filter.substr(1))
    return (id + '').startsWith(this.filter) || tags.any(t => t.toLowerCase() == this.filter.toLowerCase());
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