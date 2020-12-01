import h from "stage0";
import { create, Module } from "../../utils/injector";
import * as PROFILE from "../../utils/profiler";
import { View, VIEW } from "../apis/app";
import { BUS, MessageHandlerReflective } from "../apis/handler";
import { PostFrame } from "../edit/messages";


export async function StatusBarModule(module: Module) {
  module.execute(async injector => {
    const bus = await injector.getInstance(BUS);
    bus.connect(await create(injector, Statusbar, VIEW));
  });
}

const positionBoxTemplate = h`
  <span class="title padded-horizontally-less">Position:
    <span style="width: 45px; display: inline-block; text-align: right;">#posx</span>,
    <span style="width: 45px; display: inline-block; text-align: left;">#posy</span>
  </span>
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

const valueBoxTemplate = h`<span class="title padded-horizontally-less">#nameNode<span style="display: inline-block;">#valueNode</span></span>`;
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

const statusBarTemplate = h`<span class="pull-right" #statusbar></span>`;
function StatusBar() {
  const root = statusBarTemplate;
  const { statusbar } = statusBarTemplate.collect(root);
  const [posBox, posUpdate] = PositionBox();
  const [sectorBox, sectorUpdate] = ValueBox('Sector', 25);
  const [drawsBox, drawsUpdate] = ValueBox('Draws', 85);
  const [fpsBox, fpsUpdate] = ValueBox('FPS', 35);
  statusbar.appendChild(posBox);
  statusbar.appendChild(sectorBox);
  statusbar.appendChild(drawsBox);
  statusbar.appendChild(fpsBox);
  return { root, updaters: { posUpdate, sectorUpdate, drawsUpdate, fpsUpdate } };
}

export class Statusbar extends MessageHandlerReflective {
  private updaters: {
    posUpdate: (x: number, y: number) => void;
    sectorUpdate: (value: any) => void;
    drawsUpdate: (value: any) => void;
    fpsUpdate: (value: any) => void;
  };

  constructor(private view: View) {
    super();
    const { root, updaters } = StatusBar();
    document.getElementById('footer').appendChild(root);
    this.updaters = updaters;
  }

  public PostFrame(msg: PostFrame) {
    const view = this.view;
    const profile = PROFILE.get(null);
    const draws = profile.counts['drawsRequested'] || 0;
    const skips = profile.counts['drawsMerged'] || 0;
    this.updaters.posUpdate(view.x, view.y);
    this.updaters.sectorUpdate(view.sec);
    this.updaters.fpsUpdate((1000 / profile.time).toFixed(0));
    this.updaters.drawsUpdate(draws + ' / ' + (draws - skips));
  }
}
