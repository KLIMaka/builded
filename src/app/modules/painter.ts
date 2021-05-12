import h from "stage0";
import tippy from "tippy.js";
import { art } from "../../build/artraster";
import { animate, ArtInfoProvider } from "../../build/formats/art";
import { enumerate, range } from "../../utils/collections";
import { drawToCanvas } from "../../utils/imgutils";
import { create, lifecycle, Module, plugin } from "../../utils/injector";
import { iter } from "../../utils/iter";
import { clamp, int, len2d } from "../../utils/mathutils";
import { palRasterizer, Raster, Rasterizer, rect, resize, superResize, transform } from "../../utils/pixelprovider";
import { DrawPanel, RasterProvider } from "../../utils/ui/drawpanel";
import { menuButton, search } from "../../utils/ui/renderers";
import { addDragController, div } from "../../utils/ui/ui";
import { ART, Scheduler, SCHEDULER, SchedulerTask, TaskHandle } from "../apis/app";
import { BUS, busDisconnector } from "../apis/handler";
import { Ui, UI, Window } from "../apis/ui";
import { namedMessageHandler } from "../edit/messages";
import { PicNumCallback } from "../edit/tools/selection";
import { Palette, PicTags, PIC_TAGS, RAW_PAL, RAW_PLUs, TRANS_TABLE } from "./artselector";
import { SHADOWSTEPS } from "./gl/buildgl";
import { Sdf, sdf, sintersect, ssub, sub, sunion, union } from "../../app/modules/sdf/sdfraster";
import { vec2, vec3, Vec3Array } from "../../libs_js/glmatrix";


export async function PainterModule(module: Module) {
  module.bind(plugin('Painter'), lifecycle(async (injector, lifecycle) => {
    const bus = await injector.getInstance(BUS);
    const editor = await create(injector, Painter, UI, SCHEDULER);
    lifecycle(bus.connect(namedMessageHandler('show_painter', () => editor.show())), busDisconnector(bus));
    lifecycle(editor, async e => e.stop());
  }));
}

function grayRasterizer(scale: number): Rasterizer<number> {
  return (raster, out) => {
    const w = raster.width;
    const h = raster.height;
    for (let y = 0; y < h / scale; y++) {
      for (let x = 0; x < w / scale; x++) {
        set(raster, out, x * scale, y * scale, scale);
      }
    }
  }
}

function set(raster: Raster<number>, out: Uint8Array | Uint8ClampedArray | number[], x: number, y: number, scale: number) {
  const nx = x + int(scale / 2);
  const ny = y + int(scale / 2);
  const c = raster.pixel(nx, ny);
  for (let dy = 0; dy < scale; dy++) {
    for (let dx = 0; dx < scale; dx++) {
      const off = (x + dx + (y + dy) * raster.width) * 4;
      out[off + 0] = c;
      out[off + 1] = c;
      out[off + 2] = c;
      out[off + 3] = 255;
    }
  }
}

class Model {
  private x = 0;
  private y = 0;
  private points: Vec3Array[] = [];
  private dragged: Vec3Array;

  constructor(private canvas: HTMLCanvasElement, private cb: () => void) {
    canvas.addEventListener('mousemove', e => this.move(e.offsetX, e.offsetY));
    canvas.addEventListener('mousedown', e => this.drag())
    canvas.addEventListener('mouseup', e => this.drop())
  }

  addPoint(x: number, y: number, z: number): number {
    const id = this.points.length;
    this.points.push(vec3.fromValues(x, y, z));
    this.redraw();
    return id;
  }

  getPoint(id: number): Vec3Array {
    return this.points[id];
  }

  private findPoint(): Vec3Array {
    let minLen = Number.MAX_VALUE;
    let closest: Vec3Array = null;
    for (const p of this.points) {
      const l = len2d(p[0] - this.x, p[1] - this.y);
      if (l < minLen) {
        minLen = l;
        closest = p;
      }
    }
    return minLen < 0.01 ? closest : null;
  }

  private redraw() {
    const ctx = this.canvas.getContext('2d');
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    const point = this.findPoint();
    ctx.fillStyle = 'rgba(127,127,127,1)';
    ctx.strokeStyle = 'rgba(127,127,127,1)';
    for (const p of this.points) {
      const x = p[0] * w;
      const y = p[1] * h;
      ctx.beginPath();
      ctx.rect(x - 5, y - 5, 10, 10);
      ctx.closePath();
      if (p == point) ctx.fill();
      else ctx.stroke();
    }
  }


  public drag() {
    const closest = this.findPoint();
    if (closest == null) return;
    this.dragged = closest;
  }

  public drop() {
    this.dragged = null;
  }

  public move(x: number, y: number) {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.x = x / w;
    this.y = y / h;

    if (this.dragged != null) {
      const nx = Math.round(this.x / 0.1) * 0.1;
      const ny = Math.round(this.y / 0.1) * 0.1;
      vec3.set(this.dragged, nx, ny, this.dragged[2]);
      this.cb();
    }
    this.redraw();
  }
}


class Painter {
  private window: Window;
  private display: HTMLCanvasElement;
  private overlay: HTMLCanvasElement;
  private model: Model;
  private handle: TaskHandle;
  private center1: number;
  private center2: number;
  private light: number;

  constructor(private ui: Ui, private scheduler: Scheduler) {
    const view = this.createCanvases();
    this.model = new Model(this.overlay, () => this.redraw());
    this.window = ui.builder.window()
      .title('Painter')
      .draggable(true)
      .closeable(true)
      .centered(true)
      .size(640, 640)
      .content(view)
      .build();

    this.center1 = this.model.addPoint(0.3, 0.5, 0.5);
    this.center2 = this.model.addPoint(0.8, 0.5, 0.5);
    this.light = this.model.addPoint(0.5, 0.0, 0.2);
  }

  private createCanvases(): HTMLElement {
    const template = h`<div style="position: relative;">
    <canvas width="640" height="640" style="position: absolute; left: 0; top: 0" #display></canvas>
    <canvas width="640" height="640" style="position: absolute; left: 0; top: 0" #overlay></canvas>
    </div>`;
    const widget = <HTMLElement>template.cloneNode(true);
    const { overlay, display } = template.collect(widget);
    this.display = display;
    this.overlay = overlay;
    return widget;
  }

  private redraw() {
    if (this.handle != null) this.handle.stop();
    this.handle = this.scheduler.addTask(this.render());
  }

  private * render(): SchedulerTask {
    const ctx = this.display.getContext('2d');
    const toLight = vec3.create();
    const curpos = vec3.create();
    const move = vec3.create();
    const center1 = this.model.getPoint(this.center1);
    const center2 = this.model.getPoint(this.center2);
    const light = this.model.getPoint(this.light);
    const s: Sdf<number> = {
      dist: (pos: Vec3Array) => sunion(pos, p => sunion(p, p => vec3.distance(p, center1) - 0.2, p => vec3.distance(p, center2) - 0.2, 0.04), p => 0.5 - p[2], 0.004),

      color: (pos: Vec3Array, normal: Vec3Array) => {
        vec3.sub(toLight, light, pos);
        vec3.normalize(toLight, toLight);
        vec3.scale(move, toLight, 0.0001);
        vec3.add(curpos, pos, move);
        let shadow = 1.0;
        let ph = 1e10;
        for (let l = 0.0001; l < 4;) {
          const d = s.dist(curpos);
          if (d <= 1e-5) {
            shadow = 0.0;
            break;
          }
          const y = d * d / (2 * ph);
          const z = Math.sqrt(d * d - y * y);
          shadow = Math.min(shadow, 10 * z / Math.max(0.0, l - y) / l);
          ph = d;
          l += d;
          vec3.scale(move, toLight, l);
          vec3.add(curpos, pos, move);
        }

        const r = clamp(shadow, 0, 1);
        const rr = r * r * (3 - 2 * r);
        let occ = 0;
        let sca = 1;
        for (let i = 0; i < 5; i++) {
          const h = 0.001 + 0.15 * i / 4.0;
          vec3.scale(curpos, normal, h);
          vec3.add(curpos, pos, curpos);
          const d = s.dist(curpos)
          occ += (h - d) * sca;
          sca *= 0.95;
        }
        const ao = clamp(1 - 1.5 * occ, 0, 1);

        return int(20 + clamp(vec3.dot(normal, toLight), 0, 1) * 200 * ao * rr);
      }
    }

    let handle = yield;
    for (let scale = 32; scale >= 1; scale /= 2) {
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          drawToCanvas(sdf(64, 64, s, 0, x * 64, y * 64, 10), ctx, grayRasterizer(scale), x * 64, y * 64);
        }
        handle = yield;
      }
    }
  }

  public stop() { this.window.destroy() }
  public show() { this.window.show(); this.redraw() }
}