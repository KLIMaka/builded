import h from "stage0";
import { int } from "../../../utils/mathutils";
import { Raster, rasterizeRGBA8, rect, resize } from "../../../utils/pixelprovider";

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

export type WorkplaneContext = {
  xoff: number,
  yoff: number,
  scale: number,
  addMouseHandler: (handler: MouseEventHandler) => void;
  addKeyboardHandler: (handler: KeyboardEventHandler) => void;
};

export type Renderer = () => void;
export type WorkplaneRendererBuilder = (canvas: HTMLCanvasElement, ctx: WorkplaneContext) => Renderer;

export function rasterWorkplaneRenderer(raster: Raster<number>): WorkplaneRendererBuilder {
  return (canvas, wctx) => {
    const cache = createImageDataCache();
    return () => {
      const ctx = canvas.getContext('2d');
      const scaled = resize(raster, raster.width * wctx.scale, raster.height * wctx.scale);
      const framed = rect(scaled, -wctx.xoff, -wctx.yoff, canvas.height - wctx.xoff, canvas.height - wctx.yoff, 0);
      const id = cache(canvas.width, canvas.height);
      rasterizeRGBA8(framed, id.data.buffer);
      ctx.putImageData(id, 0, 0);
    }
  }
}

function drawGrid(ctx: CanvasRenderingContext2D, size: number, w: number, h: number, xoff: number, yoff: number, scale: number, goff: number) {
  const dg = size * scale;

  ctx.beginPath();
  const xcount = 2 + int(w / scale / size);
  const startx = xoff + Math.floor(-xoff / dg) * dg;
  for (let i = 0; i < xcount; i++) {
    const x = startx + i * dg;
    ctx.moveTo(x, 0.5 - goff);
    ctx.lineTo(x, goff + h + 0.5);
  }

  const ycount = 2 + int(h / scale / size);
  const starty = yoff + Math.floor(-yoff / dg) * dg;
  for (let i = 0; i < ycount; i++) {
    const y = starty + i * dg;
    ctx.moveTo(0.5 - goff, y);
    ctx.lineTo(goff + w + 0.5, y);
  }
  ctx.closePath();
  ctx.stroke();
}

export function renderGrid(canvas: HTMLCanvasElement, wctx: WorkplaneContext, size: number) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.setLineDash([3, 3]);
  ctx.clearRect(0, 0, w, h);
  ctx.lineWidth = 0.9;
  if (size == 0) return;

  ctx.strokeStyle = 'white';
  drawGrid(ctx, size, w, h, wctx.xoff, wctx.yoff, wctx.scale, 0);
  ctx.strokeStyle = 'black';
  drawGrid(ctx, size, w, h, wctx.xoff, wctx.yoff, wctx.scale, 3);
}

const CANVAS_HOLDER_TEMPLATE = h`<div style="position: relative;"></div>`;
const CANVAS_TEMPLATE = h` <canvas style="position: absolute; left: 0; top: 0"></canvas>`;

type MouseEventHandler = (x: number, y: number, buttons: number, wheel: number) => void;
type KeyboardEventHandler = (key: string, down: boolean) => void;

export class Workplane implements WorkplaneContext {
  scale = 1;
  xoff = 0;
  yoff = 0;

  private renderers: Renderer[] = [];
  private holder: HTMLElement;
  private controller: HTMLCanvasElement;
  private mouseHandlers: MouseEventHandler[] = [];
  private keyboardHandlers: KeyboardEventHandler[] = [];

  constructor(
    private w: number,
    private h: number,
    builders: WorkplaneRendererBuilder[]
  ) {
    this.holder = <HTMLElement>CANVAS_HOLDER_TEMPLATE.cloneNode(true);
    this.controller = this.createCanvas(h, w);
    this.holder.appendChild(this.controller);
    for (const builder of builders) {
      const canvas = this.createCanvas(h, w)
      this.controller.before(canvas);
      this.renderers.push(builder(canvas, this));
    }
    this.controller.addEventListener('wheel', e => this.mouseHandle(e.x, e.y, e.buttons, e.deltaY));
    this.controller.addEventListener('mousemove', e => this.mouseHandle(e.x, e.y, e.buttons, 0));
    this.controller.addEventListener('mousedown', e => this.mouseHandle(e.x, e.y, e.buttons, 0));
    this.controller.addEventListener('mouseup', e => this.mouseHandle(e.x, e.y, e.buttons, 0));
    this.controller.addEventListener('keydown', e => this.keyboardHandle(e.key, true));
    this.controller.addEventListener('keyup', e => this.keyboardHandle(e.key, false));
    this.addDragController();
    this.redraw();
  }

  private mouseHandle(x: number, y: number, buttons: number, wheel: number) {
    for (const h of this.mouseHandlers) h(x, y, buttons, wheel);
  }

  private keyboardHandle(key: string, down: boolean) {
    for (const h of this.keyboardHandlers) h(key, down);
  }

  public addMouseHandler(handler: MouseEventHandler) {
    this.mouseHandlers.push(handler);
  }

  public addKeyboardHandler(handler: KeyboardEventHandler) {
    this.keyboardHandlers.push(handler);
  }

  private addDragController() {
    let isDrag = false;
    let oldx = 0;
    let oldy = 0;

    this.addMouseHandler((x, y, buttons, wheel) => {
      let needToRedraw = false;
      if (wheel > 0) { this.scale *= 1 / 1.1; needToRedraw = true; }
      if (wheel < 0) { this.scale *= 1.1; needToRedraw = true; }
      isDrag = buttons == 1;
      if (isDrag) {
        const dx = x - oldx;
        const dy = y - oldy;
        if (dx != 0 || dy != 0) {
          this.xoff += dx;
          this.yoff += dy;
          needToRedraw = true;
        }
      }
      oldx = x;
      oldy = y;
      if (needToRedraw) this.redraw();
    });
    this.addKeyboardHandler((key, down) => {
      console.log(key, down);
    });
  }

  private createCanvas(h: number, w: number) {
    const canvas = <HTMLCanvasElement>CANVAS_TEMPLATE.cloneNode(true);
    canvas.height = h;
    canvas.width = w;
    return canvas;
  }

  public redraw() {
    for (const r of this.renderers) r();
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
