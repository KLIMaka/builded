import h from "stage0";
import { ambientOcclusion, lambert, normal, sdf, Sdf, softShadow, sphere, ssub, sunion } from "../../app/modules/sdf/sdfraster";
import { vec3, Vec3Array } from "../../libs_js/glmatrix";
import { filter, map, range } from "../../utils/collections";
import { drawToCanvas } from "../../utils/imgutils";
import { create, lifecycle, Module, plugin } from "../../utils/injector";
import { clamp, int, len2d, octaves2d, perlin2d } from "../../utils/mathutils";
import { Raster, Rasterizer, array, resize, rect } from "../../utils/pixelprovider";
import { listProp, NavItem1, navTree, NavTreeModel, Oracle, properties, rangeProp, sliderToolbarButton, ValueHandleIml } from "../../utils/ui/renderers";
import { addDragController, replaceContent } from "../../utils/ui/ui";
import { VecStack3d } from "../../utils/vecstack";
import { Scheduler, SCHEDULER, SchedulerTask, TaskHandle } from "../apis/app";
import { BUS, busDisconnector } from "../apis/handler";
import { Ui, UI, Window } from "../apis/ui";
import { namedMessageHandler } from "../edit/messages";


export async function PainterModule(module: Module) {
  module.bind(plugin('Painter'), lifecycle(async (injector, lifecycle) => {
    const bus = await injector.getInstance(BUS);
    const editor = await create(injector, Painter, UI, SCHEDULER);
    lifecycle(bus.connect(namedMessageHandler('show_painter', () => editor.show())), busDisconnector(bus));
    lifecycle(editor, async e => e.stop());
  }));
}

function grayRasterizer(raster: Raster<number>, out: Uint8Array | Uint8ClampedArray | number[]) {
  const w = raster.width;
  const h = raster.height;
  let off = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const pixel = raster.pixel(x, y);
      out[off + 0] = pixel;
      out[off + 1] = pixel;
      out[off + 2] = pixel;
      out[off + 3] = 255;
      off += 4;
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
    this.redraw();
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
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.strokeStyle = 'rgba(255,255,255,1)';
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

class Model1Item implements NavItem1 {
  private selectCallback: ((select: boolean) => void)[] = [];

  constructor(public title: string) { }

  setSelect(cb: (select: boolean) => void) { this.selectCallback.push(cb) }
  select(selected: boolean) { this.selectCallback.forEach(cb => cb(selected)) }
}

class ShapesModel implements NavTreeModel {
  items: NavItem1[] = [];
  title = "Shapes";
  private changeCallback: () => void;
  private selected: Model1Item = null;

  setOnCnange(cb: () => void) { this.changeCallback = cb }

  select(item: Model1Item) {
    if (this.selected == item) return;
    if (this.selected != null) this.selected.select(false);
    item.select(true);
    this.selected = item;
  }

  add(title: string) {
    const item = new Model1Item(title);
    this.items.push(item);
    this.changeCallback();
    return item;
  }
}

interface Shape {
  attach(buff: number[], size: number, cb: () => void): void;
  remove(): void;
  readonly settings: HTMLElement;
}

interface Image {
  pixel(x: number, y: number): number;
  readonly settings: HTMLElement;
  onchange(cb: () => void): void;
}

class ImageShape implements Shape {
  private buff: number[];
  private size: number;
  private redrawCallback: () => void;

  settings: HTMLElement;

  constructor(readonly image: Image) {
    this.settings = image.settings;
    this.image.onchange(() => this.redraw());
  }

  private redraw() {
    if (this.redrawCallback == null) return;

    let off = 0;
    const size = this.size;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        this.buff[off++] = this.image.pixel(x / size, y / size);
      }
    }
    this.redrawCallback();
  }

  attach(buff: number[], size: number, cb: () => void): void {
    this.redrawCallback = cb;
    this.size = size;
    this.buff = buff;
    this.redraw();
  }

  remove(): void {
    this.redrawCallback = null;
    this.size = null;
    this.buff = null;
  }
}

function perlin(): Image {
  let changecb: () => void;
  const scale = new ValueHandleIml(1024);
  const octaves = new ValueHandleIml(1);
  scale.addListener(() => changecb());
  octaves.addListener(() => changecb());
  const settings = properties([
    rangeProp('Scale', 0, 10 * 1024, scale),
    rangeProp('Octaves', 1, 4, octaves)
  ]);
  const pixel = (x: number, y: number) => {
    const noise = octaves2d(perlin2d, octaves.get());
    const s = scale.get() / 100;
    return 127 + 127 * noise(x * s, y * s);
  }
  const onchange = (cb: () => void) => changecb = cb;
  return { pixel, settings, onchange }
}

function circle(): Image {
  let changecb: () => void;
  const radius = new ValueHandleIml(50);
  radius.addListener(() => changecb());
  const settings = properties([
    rangeProp('Radius', 1, 100, radius),
  ]);
  const pixel = (x: number, y: number) => {
    const r = radius.get() / 100;
    const l = len2d(x - 0.5, y - 0.5);
    return 256 * Math.sqrt(clamp(r - l, 0, r));
  }
  const onchange = (cb: () => void) => changecb = cb;
  return { pixel, settings, onchange }
}

function select(p: (name: string) => Shape, oracle: Oracle<string>): Image {
  let changecb: () => void;
  const src = new ValueHandleIml('');
  const from = new ValueHandleIml(0);
  const to = new ValueHandleIml(255);
  src.addListener(() => changecb());
  from.addListener(() => changecb());
  to.addListener(() => changecb());
  const settings = properties([
    listProp('Source', oracle, src),
    rangeProp('From', 0, 255, from),
    rangeProp('To', 0, 255, to),
  ]);
  const pixel = (x: number, y: number) => {
    const shape = p(src.get());
    if (!(shape instanceof ImageShape)) return 0;
    const value = shape.image.pixel(x, y);
    return value >= from.get() && value <= to.get() ? 255 : 0;
  }
  const onchange = (cb: () => void) => changecb = cb;
  return { pixel, settings, onchange }
}

function displace(p: (name: string) => Shape, oracle: Oracle<string>): Image {
  let changecb: () => void;
  const src = new ValueHandleIml('');
  const displace = new ValueHandleIml('');
  const scale = new ValueHandleIml(100);
  src.addListener(() => changecb());
  displace.addListener(() => changecb());
  scale.addListener(() => changecb());
  const settings = properties([
    listProp('Source', oracle, src),
    listProp('Displace', oracle, displace),
    rangeProp('Scale', -1000, 1000, scale),
  ]);
  const pixel = (x: number, y: number) => {
    const source = p(src.get());
    if (!(source instanceof ImageShape)) return 0;
    const disp = p(displace.get());
    if (!(disp instanceof ImageShape)) return 0;
    const d = 0.00001;
    const s = scale.get() * 100;

    const d1 = disp.image.pixel(x - d, y);
    const d2 = disp.image.pixel(x + d, y);
    const d3 = disp.image.pixel(x, y - d);
    const d4 = disp.image.pixel(x, y + d);

    const dx = (d1 - d2) / 256;
    const dy = (d3 - d4) / 256;

    return source.image.pixel(x + dx * s, y + dy * s);
  }
  const onchange = (cb: () => void) => changecb = cb;
  return { pixel, settings, onchange }
}

class Painter {
  private window: Window;
  private display: HTMLCanvasElement;
  private overlay: HTMLCanvasElement;
  private sidebarRight: HTMLElement;
  private sidebarLeft: HTMLElement;
  private model: Model;

  private centerX = 320;
  private centerY = 320;
  private scale = 1.0;

  private buffer: number[];
  private bufferSize = 512;

  private shapes: Shape[] = [];
  private currentShapeId: number;
  private shapesModel = new ShapesModel();
  private shapeMap = new Map<string, Shape>();

  constructor(private ui: Ui, private scheduler: Scheduler) {
    this.recreateBuffer();

    const view = this.createView();
    this.model = new Model(this.overlay, () => this.redraw());
    this.window = ui.builder.window()
      .title('Painter')
      .draggable(true)
      .closeable(true)
      .centered(true)
      .size(1081, 640)
      .content(view)
      .build();

    this.addShape('Circle', new ImageShape(circle()));
    this.addShape('Perlin', new ImageShape(perlin()));
    this.addShape('Select', new ImageShape(select(this.shapeProvider(), this.shapeOracle())));
    this.addShape('Displace', new ImageShape(displace(this.shapeProvider(), this.shapeOracle())));
  }

  private shapeProvider(): (name: string) => Shape {
    return s => this.shapeMap.get(s);
  }

  private shapeOracle(): Oracle<string> {
    return s => filter(this.shapeMap.keys(), k => s.startsWith(s));
  }

  private recreateBuffer() {
    this.buffer = new Array<number>(this.bufferSize * this.bufferSize);
  }

  private addShape(name: string, shape: Shape) {
    const id = this.shapes.length;
    this.shapes.push(shape);
    const item = this.shapesModel.add(name);
    item.setSelect(s => { if (s) this.selectShape(id) })
    this.shapeMap.set(name, shape);
  }

  private selectShape(id: number) {
    const shape = this.shapes[id];
    const lastShape = this.shapes[this.currentShapeId];
    if (shape == undefined) return;
    if (lastShape != undefined) lastShape.remove();
    this.currentShapeId = id;
    replaceContent(this.sidebarRight, shape.settings);
    shape.attach(this.buffer, this.bufferSize, () => this.redraw());
  }

  private redraw() {
    const ctx = this.display.getContext('2d');
    const img = array(this.buffer, this.bufferSize, this.bufferSize);
    const scale = int(this.bufferSize * this.scale);
    const scaled = resize(img, scale, scale);
    const off = int((this.bufferSize / 2) * this.scale);
    const x = this.centerX - off;
    const y = this.centerY - off;
    const framed = rect(scaled, -x, -y, this.display.width - x, this.display.height - y, 0);
    drawToCanvas(framed, ctx, grayRasterizer);
  }

  private createView(): HTMLElement {
    const template = h` 
    <div class='pane-group'>
      <div class='pane pane-sm sidebar' #sidebarleft></div>
      <div class='pane' style="position: relative;">
        <canvas width="640" height="640" style="position: absolute; left: 0; top: 0" #display></canvas>
        <canvas width="640" height="640" style="position: absolute; left: 0; top: 0" #overlay></canvas>    
      </div>
      <div class='pane pane-sm sidebar' #sidebarright></div>
    </div>`;
    const widget = <HTMLElement>template.cloneNode(true);
    const { overlay, display, sidebarleft, sidebarright } = template.collect(widget);
    this.display = display;
    this.overlay = overlay;
    this.sidebarLeft = sidebarleft;
    this.sidebarRight = sidebarright;

    addDragController(overlay, (dx, dy, dscale) => {
      this.centerX += dx;
      this.centerY += dy;
      this.scale *= dscale;
      this.redraw();
    });

    navTree(sidebarleft, this.shapesModel);
    return widget;
  }

  public stop() { this.window.destroy() }
  public show() { this.window.show(); this.redraw() }
}