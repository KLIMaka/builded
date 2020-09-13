import { createState, SetStateFunction } from "solid-js";
import { render } from "solid-js/dom";
import { create, Injector } from "../../utils/injector";
import * as PROFILE from "../../utils/profiler";
import { View, VIEW } from "../apis/app";
import { BUS, MessageHandlerReflective } from "../apis/handler";
import { PostFrame } from "../edit/messages";


export async function StatusBarModule(injector: Injector) {
  const bus = await injector.getInstance(BUS);
  bus.connect(await create(injector, Statusbar, VIEW));
}

class StatusbarState {
  public posx: number;
  public posy: number;
  public sector: number;
  public draws: string;
  public fps: string;
}

const Box = (ref: { name: string, size: number, value: any }) => {
  return () => <span class="title padded-horizontally-less">{ref.name}:  <span style={`width: ${ref.size}px; display: inline-block;`}>{ref.value}</span></span>
}

export class Statusbar extends MessageHandlerReflective {
  setState: SetStateFunction<StatusbarState>;

  constructor(private view: View) {
    super();
    const [state, setState] = createState(new StatusbarState());
    this.setState = setState;
    render(() => {
      return <span class="pull-right">
        <span class="title padded-horizontally-less">Position:
          <span style="width: 45px; display: inline-block; text-align: right;">[{state.posx}</span>,
          <span style="width: 45px; display: inline-block; text-align: left;">{state.posy}]</span>
        </span>
        <Box name='Sector' size={25} value={state.sector} />
        <Box name='Draws' size={85} value={state.draws} />
        <Box name='FPS' size={35} value={state.fps} />
      </span>;
    }, document.getElementById('footer'));
  }

  public PostFrame(msg: PostFrame) {
    const view = this.view;
    const profile = PROFILE.get(null);
    const draws = profile.counts['drawsRequested'] ?? 0;
    const skips = profile.counts['drawsMerged'] ?? 0;
    this.setState('posx', view.x);
    this.setState('posy', view.y);
    this.setState('sector', view.sec);
    this.setState('fps', (1000 / profile.time).toFixed(0));
    this.setState('draws', draws + ' / ' + (draws - skips));
  }
}
