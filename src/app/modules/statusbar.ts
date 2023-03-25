import h, { hElement } from "stage0";
import { create, lifecycle, Module, plugin } from "../../utils/injector";
import { Profiler, PROFILER } from "../../utils/profiler";
import { View, VIEW } from "../apis/app";
import { BUS, busDisconnector, MessageHandlerReflective } from "../apis/handler";
import { PostFrame } from "../edit/messages";


export async function StatusBarModule(module: Module) {
  module.bind(plugin('StatusBar'), lifecycle(async (injector, lifecycle) => {
    const bus = await injector.getInstance(BUS);
    const statusbar = await create(injector, Statusbar, VIEW, PROFILER);
    lifecycle(bus.connect(statusbar), busDisconnector(bus));
    lifecycle(statusbar, async s => s.stop());
  }));
}

const positionBoxTemplate = h`
  <div class="hitem">Position:
    <span style="width: 45px; display: inline-block; text-align: right;">#posx</span>,
    <span style="width: 45px; display: inline-block; text-align: left;">#posy</span>
  </div>
`
function PositionBox(): [Node, (x: number, y: number) => void] {
  const root = positionBoxTemplate;
  const { posx, posy } = positionBoxTemplate.collect(root);
  let cachedPosX = 0;
  let cachedPosY = 0;
  const update = (x: number, y: number) => {
    if (x != cachedPosX) {
      cachedPosX = x;
      posx.nodeValue = `[${x}`;
    }
    if (y != cachedPosY) {
      cachedPosY = y;
      posy.nodeValue = `${y}]`;
    }
  }

  return [root, update];
}

const valueBoxTemplate = h`<div class="hitem">#nameNode<span style="display: inline-block;">#valueNode</span></div>`;
function ValueBox(name: String, size: number): [Node, (value: any) => void] {
  const root = valueBoxTemplate.cloneNode(true);
  const { nameNode, valueNode } = valueBoxTemplate.collect(root);
  nameNode.nodeValue = `${name}: `;
  valueNode.parentElement.style.width = `${size}px`;
  let cachedValue = null;
  const update = (value: any) => {
    if (value != cachedValue) {
      valueNode.nodeValue = value;
      cachedValue = value;
    }
  }
  return [root, update];
}

const statusBarTemplate = h`<div class="item-bar" #statusbar></div>`;
function StatusBar() {
  const root = statusBarTemplate;
  const { statusbar } = statusBarTemplate.collect(root);
  const [posBox, posUpdate] = PositionBox();
  const [sectorBox, sectorUpdate] = ValueBox('Sector', 25);
  const [drawsBox, drawsUpdate] = ValueBox('Draws', 85);
  const [bufferBox, bufferUpdate] = ValueBox('Buffer', 35);
  const [fpsBox, fpsUpdate] = ValueBox('FPS', 35);
  statusbar.appendChild(posBox);
  statusbar.appendChild(sectorBox);
  statusbar.appendChild(drawsBox);
  statusbar.appendChild(bufferBox);
  statusbar.appendChild(fpsBox);
  return { root, updaters: { posUpdate, sectorUpdate, drawsUpdate, bufferUpdate, fpsUpdate } };
}

export class Statusbar extends MessageHandlerReflective {
  private updaters: {
    posUpdate: (x: number, y: number) => void;
    sectorUpdate: (value: any) => void;
    drawsUpdate: (value: any) => void;
    fpsUpdate: (value: any) => void;
    bufferUpdate: (value: any) => void;
  };
  private root: hElement;
  private lastUpdate = 0;

  constructor(private view: View, private profiler: Profiler) {
    super();
    const { root, updaters } = StatusBar();
    this.root = root;
    document.getElementById('footer').appendChild(root);
    this.updaters = updaters;
  }

  public stop() {
    document.getElementById('footer').removeChild(this.root);
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
