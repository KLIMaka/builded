import { create, Injector } from "../../utils/injector";
import { AbstractPixelProvider, BlendFunc } from "../../utils/pixelprovider";
import * as PROFILE from "../../utils/profiler";
import { View, VIEW } from "../apis/app";
import { BUS, MessageHandlerReflective } from "../apis/handler";
import { PostFrame } from "../edit/messages";


export async function StatusBarModule(injector: Injector) {
  const bus = await injector.getInstance(BUS);
  bus.connect(await create(injector, Statusbar, VIEW));
}

export class Statusbar extends MessageHandlerReflective {
  xpos: HTMLElement;
  ypos: HTMLElement;
  secpos: HTMLElement;
  fps: HTMLElement;
  draws: HTMLElement;
  buffer: HTMLCanvasElement;
  bufferPixelProvider = new BufferPixelProvider(64, 8);

  constructor(
    private view: View
  ) {
    super();
    this.xpos = document.getElementById('x_position');
    this.ypos = document.getElementById('y_position');
    this.secpos = document.getElementById('sector_position');
    this.fps = document.getElementById('fps');
    this.draws = document.getElementById('draws');
    this.buffer = <HTMLCanvasElement>document.getElementById('buffer');
  }

  public PostFrame(msg: PostFrame) {
    const view = this.view;
    this.xpos.textContent = '' + view.x;
    this.ypos.textContent = '' + view.y;
    this.secpos.textContent = '' + view.sec;
    this.fps.textContent = (1000 / PROFILE.get(null).time).toFixed(0);
    const draws = PROFILE.get(null).counts['drawsRequested'] | 0;
    const skips = PROFILE.get(null).counts['drawsMerged'] | 0;
    this.draws.textContent = '' + draws + ' / ' + (draws - skips);
    // this.bufferPixelProvider.buffer = PROFILE.get(null).counts['buffer'];
    // drawToCanvas(this.bufferPixelProvider, this.buffer);

    // info['Rendering:'] = PROFILE.get('draw').time.toFixed(2) + 'ms';
    // info['Processing:'] = PROFILE.get('processing').time.toFixed(2) + 'ms';
    // info['Hitscan:'] = PROFILE.get('hitscan').time.toFixed(2) + 'ms';
    // info['Sectors:'] = PROFILE.get('processing').counts['sectors'];
    // info['Walls:'] = PROFILE.get('processing').counts['walls'];
    // info['Sprites:'] = PROFILE.get('processing').counts['sprites'];
    // info['PVS:'] = PROFILE.get(null).counts['pvs'] || 0;
    // info['RORs:'] = PROFILE.get(null).counts['rors'];
    // info['Mirrors:'] = PROFILE.get(null).counts['mirrors'];
    // info['Buffer Traffic:'] = ((PROFILE.get(null).counts['traffic'] || 0) / 1024).toFixed(2) + 'k';
    // info['Buffer Updates:'] = PROFILE.get(null).counts['updates'] || 0;
    // info['Buffer Usage:'] = (100 * PROFILE.get(null).counts['buffer']).toFixed(2) + '%';
    // info['Draw Calls:'] = PROFILE.get(null).counts['draws'];
  }
}

class BufferPixelProvider extends AbstractPixelProvider {
  public buffer: number[];
  private color = new Uint8Array([0, 0, 0, 255]);

  public putToDst(x: number, y: number, dst: Uint8Array, dstoff: number, blend: BlendFunc): void {
    this.color[0] = this.buffer[x] * 255;
    blend(dst, dstoff, this.color, 0);
  }
}