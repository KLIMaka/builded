import { create, lifecycle, Module, plugin } from "../../utils/injector";
import { Profiler, PROFILER } from "../../utils/profiler";
import { View, VIEW } from "../apis/app";
import { BUS, busDisconnector, MessageHandlerReflective } from "../apis/handler";
import { PostFrame } from "../edit/messages";
import { Ui } from "app/apis/ui";
import { UI } from "app/apis/ui";
import { div, Element, span } from "utils/ui/ui";


export async function StatusBarModule(module: Module) {
  module.bind(plugin('StatusBar'), lifecycle(async (injector, lifecycle) => {
    const bus = await injector.getInstance(BUS);
    const statusbar = await create(injector, Statusbar, VIEW, PROFILER, UI);
    lifecycle(bus.connect(statusbar), busDisconnector(bus));
    lifecycle(statusbar, async s => s.stop());
  }));
}

function PositionBox(): [Element, (x: number, y: number) => void] {
  const item = div('hitem').text('Position');
  const posx = span().css('width', '45px').css('display', 'inline-block').css('text=align', 'right');
  const posy = span().css('width', '45px').css('display', 'inline-block').css('text=align', 'left');
  item.append(posx).appendText(',').append(posy);

  let cachedPosX = 0;
  let cachedPosY = 0;
  const update = (x: number, y: number) => {
    if (x != cachedPosX) {
      cachedPosX = x;
      posx.text(`[${x}`);
    }
    if (y != cachedPosY) {
      cachedPosY = y;
      posy.text(`${y}]`);
    }
  }

  return [item, update];
}

function ValueBox(name: string, size: number): [Element, (value: any) => void] {
  const item = div('hitem').appendText(name + ' ');
  const label = span().css('display', 'inline-block').css('width', `${size}px`);
  item.append(label);
  let cachedValue = null;
  const update = (value: any) => {
    if (value != cachedValue) {
      label.text(value);
      cachedValue = value;
    }
  }
  return [item, update];
}

function StatusBar() {
  const statusbar = div('item-bar');
  const [posBox, posUpdate] = PositionBox();
  const [sectorBox, sectorUpdate] = ValueBox('Sector', 25);
  const [drawsBox, drawsUpdate] = ValueBox('Draws', 85);
  const [bufferBox, bufferUpdate] = ValueBox('Buffer', 35);
  const [fpsBox, fpsUpdate] = ValueBox('FPS', 35);
  statusbar.append(posBox);
  statusbar.append(sectorBox);
  statusbar.append(drawsBox);
  statusbar.append(bufferBox);
  statusbar.append(fpsBox);
  return { root: statusbar, updaters: { posUpdate, sectorUpdate, drawsUpdate, bufferUpdate, fpsUpdate } };
}

export class Statusbar extends MessageHandlerReflective {
  private updaters: {
    posUpdate: (x: number, y: number) => void;
    sectorUpdate: (value: any) => void;
    drawsUpdate: (value: any) => void;
    fpsUpdate: (value: any) => void;
    bufferUpdate: (value: any) => void;
  };

  private lastUpdate = 0;
  private root: Element;

  constructor(
    private view: View,
    private profiler: Profiler,
    private ui: Ui
  ) {
    super();
    const { root, updaters } = StatusBar();
    this.root = root;
    this.ui.getFooter().append(root);
    this.updaters = updaters;
  }

  public stop() {
    this.ui.getFooter().elem().removeChild(this.root.elem());
  }

  public PostFrame(msg: PostFrame) {
    if (this.lastUpdate + 1000 >= performance.now()) return;
    this.lastUpdate = performance.now();
    const view = this.view;
    const profile = this.profiler.frame();
    const draws = profile.counter('drawsRequested').get();
    const skips = profile.counter('drawsMerged').get();
    const frameTime = profile.timer('Frame').get();
    const bufferSize = this.profiler.global().counter('Buffer').get();
    this.updaters.posUpdate(view.x, view.y);
    this.updaters.sectorUpdate(view.sec);
    this.updaters.fpsUpdate((1000 / frameTime).toFixed(0));
    this.updaters.drawsUpdate(draws + ' / ' + (draws - skips));
    this.updaters.bufferUpdate((bufferSize / 1024).toFixed(2) + 'k');
  }
}
