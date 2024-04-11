import { Consumer, Supplier } from "@utils/types";
import { Block, Ui, Widget, style } from "app/apis/ui";
import { int } from "../../../utils/mathutils";
import { Raster, rasterizeRGBA8, rect, resize } from "../../../utils/pixelprovider";

export function createImageDataCache() {
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
  addMouseMoveHandler: (handler: MouseMoveHandler) => void;
  addMouseButtonHandler: (handler: MouseButtonHandler) => void;
  addKeyboardHandler: (handler: KeyboardHandler) => void;
};

export type Renderer = Consumer<void>;
export type WorkplaneRendererBuilder = (canvas: HTMLCanvasElement, ctx: WorkplaneContext) => Renderer;

export function rasterWorkplaneRenderer(rasterProvider: Supplier<Raster<number>>): WorkplaneRendererBuilder {
  return (canvas, wctx) => {
    const cache = createImageDataCache();
    return () => {
      if (canvas.width == 0 || canvas.height == 0) return;
      const raster = rasterProvider();
      const ctx = canvas.getContext('2d');
      const scaled = resize(raster, raster.width * wctx.scale, raster.height * wctx.scale);
      const framed = rect(scaled, -wctx.xoff, -wctx.yoff, canvas.width - wctx.xoff, canvas.height - wctx.yoff, 0);
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
  ctx.stroke();
}

export function renderGrid(canvas: HTMLCanvasElement, wctx: WorkplaneContext, size: number, pixels: number) {
  if (canvas.width == 0 || canvas.height == 0) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.setLineDash([3, 3]);
  ctx.clearRect(0, 0, w, h);
  ctx.lineWidth = 0.9;
  if (size == 0) return;

  const gsize = pixels / size;
  ctx.strokeStyle = 'white';
  drawGrid(ctx, gsize, w, h, wctx.xoff, wctx.yoff, wctx.scale, 0);
  ctx.strokeStyle = 'black';
  drawGrid(ctx, gsize, w, h, wctx.xoff, wctx.yoff, wctx.scale, 3);
}

type MouseMoveHandler = (x: number, y: number) => void;
type MouseButtonHandler = (buttons: number, wheel: number) => void;
type KeyboardHandler = (key: string, down: boolean) => void;

export class Workplane implements WorkplaneContext, Widget {
  scale = 1;
  xoff = 0;
  yoff = 0;

  private renderers: Renderer[] = [];
  private canvases: HTMLCanvasElement[] = [];
  private holder: Block;
  private controller: HTMLCanvasElement;
  private mouseMove: MouseMoveHandler[] = [];
  private mouseButton: MouseButtonHandler[] = [];
  private keyboard: KeyboardHandler[] = [];

  constructor(private ui: Ui, ...builders: WorkplaneRendererBuilder[]) {
    this.holder = ui.block().mod(style.custom(s => { s.position = 'relative'; s.flexGrow = '1' }))
    this.controller = this.createCanvas();
    this.holder.cast().appendChild(this.controller);
    for (const builder of builders) {
      const canvas = this.createCanvas()
      this.canvases.push(canvas);
      this.controller.before(canvas);
      this.renderers.push(builder(canvas, this));
    }
    this.controller.addEventListener('wheel', e => this.mouseButtonHandle(0, e.deltaY));
    this.controller.addEventListener('mousemove', e => this.mouseMoveHandle(e.x, e.y));
    this.controller.addEventListener('mousedown', e => this.mouseButtonHandle(e.buttons, 0));
    this.controller.addEventListener('mouseup', e => this.mouseButtonHandle(e.buttons, 0));
    this.controller.addEventListener('keydown', e => this.keyboardHandle(e.key, true));
    this.controller.addEventListener('keyup', e => this.keyboardHandle(e.key, false));
    new ResizeObserver(e => this.resize(<HTMLElement>e[0].target)).observe(this.controller);
    this.addDragController();
    this.redraw();
  }

  private resize(e: HTMLElement) {
    const w = e.clientWidth;
    const h = e.clientHeight;
    for (const c of this.canvases) {
      if (c.width != w) c.width = w;
      if (c.height != h) c.height = h;
    }
    this.redraw();
  }

  private mouseButtonHandle(buttons: number, wheel: number) {
    for (const h of this.mouseButton) h(buttons, wheel);
  }

  private mouseMoveHandle(x: number, y: number) {
    for (const h of this.mouseMove) h(x, y);
  }

  private keyboardHandle(key: string, down: boolean) {
    for (const h of this.keyboard) h(key, down);
  }

  public addMouseMoveHandler(handler: MouseMoveHandler) {
    this.mouseMove.push(handler);
  }

  public addMouseButtonHandler(handler: MouseButtonHandler) {
    this.mouseButton.push(handler);
  }

  public addKeyboardHandler(handler: KeyboardHandler) {
    this.keyboard.push(handler);
  }

  private addDragController() {
    let isDrag = false;
    let oldx = 0;
    let oldy = 0;

    this.addMouseButtonHandler((buttons, wheel) => {
      let needToRedraw = false;
      if (wheel > 0) { this.scale *= 1 / 1.1; needToRedraw = true; }
      if (wheel < 0) { this.scale *= 1.1; needToRedraw = true; }
      isDrag = buttons == 1;
      if (needToRedraw) this.redraw();
    });
    this.addMouseMoveHandler((x, y) => {
      let needToRedraw = false;
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
    this.addKeyboardHandler((key, down) => { console.log(key, down); });
  }

  private createCanvas(): HTMLCanvasElement {
    return this.ui.tag('canvas').mod(style.custom(s => {
      s.position = 'absolute';
      s.width = '100%'
      s.height = '100%'
    })).cast();
  }

  public redraw() {
    for (const r of this.renderers) r();
  }

  public asWidget(): Block {
    return this.holder;
  }

  public update(xoff: number, yoff: number, scale: number) {
    this.xoff = xoff;
    this.yoff = yoff;
    this.scale = scale;
    this.redraw();
  }

  public centerRect(w: number, h: number) {
    this.update((this.controller.clientWidth - w) / 2, this.yoff = (this.controller.clientHeight - h) / 2, 1);
  }
}
