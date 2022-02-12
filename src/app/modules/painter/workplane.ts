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

export type WorkplaneContext = { xoff: number, yoff: number, scale: number };
// export type WorkplaneHandler = (canvas: HTMLCanvasElement, ctx: WorkplaneContext, x:number, y:number);
export type WorkplaneRenderer = (canvas: HTMLCanvasElement, ctx: WorkplaneContext) => void;

export function rasterWorkplaneRenderer(raster: Raster<number>): WorkplaneRenderer {
  const cache = createImageDataCache();
  return (canvas, wctx) => {
    const ctx = canvas.getContext('2d');
    const scaled = resize(raster, raster.width * wctx.scale, raster.height * wctx.scale);
    const framed = rect(scaled, -wctx.xoff, -wctx.yoff, canvas.height - wctx.xoff, canvas.height - wctx.yoff, 0);
    const id = cache(canvas.width, canvas.height);
    rasterizeRGBA8(framed, id.data.buffer);
    ctx.putImageData(id, 0, 0);
  }
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, xoff: number, yoff: number, scale: number, gridoff: number) {
  const off = 0.5 * scale;
  const dg = 128 * scale;

  ctx.beginPath();
  const xcount = 2 + int(w / scale / 128);
  const startx = xoff + Math.floor(-xoff / dg) * dg;
  for (let i = 0; i < xcount; i++) {
    const x = startx + i * dg + off;
    ctx.moveTo(x, 0.5 - gridoff);
    ctx.lineTo(x, gridoff + h + 0.5);
  }

  const ycount = 2 + int(h / scale / 128);
  const starty = yoff + Math.floor(-yoff / dg) * dg;
  for (let i = 0; i < ycount; i++) {
    const y = starty + i * dg + off;
    ctx.moveTo(0.5 - gridoff, y);
    ctx.lineTo(gridoff + w + 0.5, y);
  }
  ctx.closePath();
  ctx.stroke();
}

export function gridRenderer(): WorkplaneRenderer {
  return (canvas, wctx) => {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.setLineDash([3, 3]);
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = 'white';
    drawGrid(ctx, w, h, wctx.xoff, wctx.yoff, wctx.scale, 0);
    ctx.strokeStyle = 'black';
    drawGrid(ctx, w, h, wctx.xoff, wctx.yoff, wctx.scale, 3);
  }
}

const CANVAS_HOLDER_TEMPLATE = h`<div style="position: relative;"></div>`;
const CANVAS_TEMPLATE = h` <canvas style="position: absolute; left: 0; top: 0"></canvas>`;

type Plane = { canvas: HTMLCanvasElement, renderer: WorkplaneRenderer };

export class Workplane implements WorkplaneContext {
  scale = 1;
  xoff = 0;
  yoff = 0;

  private planes: Plane[] = [];
  private holder: HTMLElement;
  private controller: HTMLCanvasElement;

  constructor(
    private w: number,
    private h: number,
    renderers: WorkplaneRenderer[]
  ) {
    this.holder = <HTMLElement>CANVAS_HOLDER_TEMPLATE.cloneNode(true);
    this.controller = this.createCanvas(h, w);
    this.holder.appendChild(this.controller);
    for (const renderer of renderers) {
      const canvas = this.createCanvas(h, w)
      this.controller.before(canvas);
      this.planes.push({ canvas, renderer })
    }

    addDragController(this.controller, (posx, posy, dx, dy, dscale) => {
      const cx = -posx;
      const cy = -posy;
      const ds = this.scale - this.scale * dscale;
      this.xoff += dx - cx * ds;
      this.yoff += dy - cy * ds;
      this.scale *= dscale;
      this.redraw();
    });
    this.redraw();
  }

  private createCanvas(h: number, w: number) {
    const canvas = <HTMLCanvasElement>CANVAS_TEMPLATE.cloneNode(true);
    canvas.height = h;
    canvas.width = w;
    return canvas;
  }

  public redraw() {
    for (const p of this.planes) p.renderer(p.canvas, this);
  }

  public getWidget(): HTMLElement {
    return this.holder;
  }

  public update(xoff: number, yoff: number, scale: number) {
    this.xoff = xoff;
    this.yoff = yoff;
    this.scale = scale;
    this.redraw();
  }
}
