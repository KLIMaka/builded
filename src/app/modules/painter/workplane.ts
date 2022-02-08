import h from "stage0";
import { int } from "../../../utils/mathutils";
import { Raster, rasterizeRGBA8, rect, resize } from "../../../utils/pixelprovider";
import { addDragController } from "../../../utils/ui/ui";

function createImageDataCache() {
  let id: ImageData = null;
  let buffer: Uint8ClampedArray = null;
  return (w: number, h: number) => {
    if (id != null && id.width == w && id.height == h) {
      return id;
    } else if (id != null && buffer.length == w * h * 4) {
      id = new ImageData(buffer, w, h);
      return id;
    } else {
      buffer = new Uint8ClampedArray(w * h * 4);
      id = new ImageData(buffer, w, h);
      return id;
    }
  }
}

export type WorkplaneRenderer = (canvas: HTMLCanvasElement, xoff: number, yoff: number, scale: number) => void;

export function rasterWorkplaneRenderer(raster: Raster<number>): WorkplaneRenderer {
  const cache = createImageDataCache();
  return (canvas, xoff, yoff, scale) => {
    const ctx = canvas.getContext('2d');
    const scaled = resize(raster, raster.width * scale, raster.height * scale);
    const framed = rect(scaled, -xoff, -yoff, canvas.height - xoff, canvas.height - yoff, 0);
    const id = cache(canvas.width, canvas.height);
    rasterizeRGBA8(framed, id.data.buffer);
    ctx.putImageData(id, 0, 0);
  }
}

export function gridRenderer(): WorkplaneRenderer {
  return (canvas, xoff, yoff, scale) => {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = 'white';
    ctx.setLineDash([3, 3]);
    ctx.clearRect(0, 0, w, h);

    const off = 0.5 * scale;
    const dg = 128 * scale;

    ctx.beginPath();
    const xcount = 2 + int(w / scale / 128);
    const startx = xoff + Math.floor(-xoff / dg) * dg;
    for (let i = 0; i < xcount; i++) {
      const x = startx + i * dg + off;
      ctx.moveTo(x, 0.5);
      ctx.lineTo(x, h + 0.5);
    }

    const ycount = 2 + int(h / scale / 128);
    const starty = yoff + Math.floor(-yoff / dg) * dg;
    for (let i = 0; i < ycount; i++) {
      const y = starty + i * dg + off;
      ctx.moveTo(0.5, y);
      ctx.lineTo(w + 0.5, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
}

const CANVAS_HOLDER_TEMPLATE = h`<div style="position: relative;"></div>`;
const CANVAS_TEMPLATE = h` <canvas style="position: absolute; left: 0; top: 0"></canvas>`;

type Plane = { canvas: HTMLCanvasElement, renderer: WorkplaneRenderer };

export class Workplane {
  private scale = 1;
  private xoff = 0;
  private yoff = 0;
  private planes: Plane[] = [];
  private holder: HTMLElement;

  constructor(
    private w: number,
    private h: number,
    renderers: WorkplaneRenderer[]
  ) {
    this.holder = <HTMLElement>CANVAS_HOLDER_TEMPLATE.cloneNode(true);
    let lastCanvas = null;
    for (const renderer of renderers) {
      const canvas = <HTMLCanvasElement>CANVAS_TEMPLATE.cloneNode(true);
      canvas.height = h;
      canvas.width = w;
      this.holder.appendChild(canvas);
      this.planes.push({ canvas, renderer })
      lastCanvas = canvas;
    }

    addDragController(lastCanvas, (posx, posy, dx, dy, dscale) => {
      const cx = -posx;
      const cy = -posy;
      const ds = this.scale * dscale - this.scale;
      this.xoff += dx - cx * ds;
      this.yoff += dy - cy * ds;
      this.scale *= dscale;
      this.redraw();
    });
    this.redraw();
  }

  public redraw() {
    for (const p of this.planes)
      p.renderer(p.canvas, this.xoff, this.yoff, this.scale);
  }

  public getHolder(): HTMLElement {
    return this.holder;
  }
}