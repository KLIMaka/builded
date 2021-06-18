import h from "stage0";
import { Vec2Array, vec3, Vec3Array } from "../../libs_js/glmatrix";
import { filter, map, range } from "../../utils/collections";
import { drawToCanvas } from "../../utils/imgutils";
import { create, lifecycle, Module, plugin } from "../../utils/injector";
import { clamp, fract, int, len2d, octaves2d, perlin2d } from "../../utils/mathutils";
import { array, Raster, rect, resize } from "../../utils/pixelprovider";
import { listProp, NavItem1, navTree, NavTreeModel, Oracle, properties, rangeProp, ValueHandleIml } from "../../utils/ui/renderers";
import { addDragController, replaceContent } from "../../utils/ui/ui";
import { Scheduler, SCHEDULER, TaskHandle } from "../apis/app";
import { BUS, busDisconnector } from "../apis/handler";
import { Ui, UI, Window } from "../apis/ui";
import { namedMessageHandler } from "../edit/messages";
import { VecStack2d } from "../../utils/vecstack";
import { circularArray, lineSegment, SdfShape, sunion, union } from "../modules/sdf/sdf";
import { KDTree } from "../../utils/kdtree";
import { FastList, List } from "../../utils/list";


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
      const pixel = int(raster.pixel(x, y));
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

enum Type {
  NORMALIZED,
  VALUE,
  VECTOR2,
  VECTOR2_NORMALIZED,
}

interface Shape {
  attach(buff: number[], size: number, cb: () => void): void;
  remove(): void;
  readonly settings: HTMLElement;
}

interface Image2d {
  pixel(stack: VecStack2d, pos: number): number;
  readonly settings: HTMLElement;
  readonly type: Type;
  addListener(cb: (img: Image2d) => void): number;
  removeListener(id: number): void;
}

class Image2dRenderer {
  private buff: number[];
  private size: number;
  private redrawCallback: () => void;
  private scheduleHandle: TaskHandle;
  private image: Image2d;
  private imageHandle: number;
  private stack = new VecStack2d(128);

  private position: number;

  constructor(private scheduler: Scheduler) {
    this.position = this.stack.push(0, 0);
  }

  public set(img: Image2d) {
    if (this.image != null) this.image.removeListener(this.imageHandle);
    this.image = img;
    this.imageHandle = img.addListener(img => this.scheduleRedraw());
    this.scheduleRedraw();
  }

  private scheduleRedraw() {
    if (this.scheduleHandle != null) this.scheduleHandle.stop();
    this.scheduleHandle = this.scheduler.addTask(this.redraw());
  }

  private * redraw() {
    if (this.redrawCallback == null) return;

    let time = 0;
    let t = window.performance.now();
    let off = 0;
    const size = this.size;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        this.stack.start();
        this.stack.set(this.position, x / size, y / size);
        const res = this.image.pixel(this.stack, this.position);
        this.buff[off++] = 256 * this.stack.get(res);
        this.stack.stop();
      }
      const dt = window.performance.now() - t;
      if (dt > 100) {
        t = window.performance.now();
        time += dt;
        this.redrawCallback();
        yield;
      }
    }
    this.redrawCallback();
    console.log(time);
  }

  attach(buff: number[], size: number, cb: () => void): void {
    this.redrawCallback = cb;
    this.size = size;
    this.buff = buff;
    this.scheduleRedraw();
  }

  remove(): void {
    this.redrawCallback = null;
    this.size = null;
    this.buff = null;
  }
}

class Callbacks<T> {
  private cbs = new FastList<(t: T) => void>();

  notify(t: T) { for (const cb of this.cbs) cb(t) }
  add(cb: (t: T) => void): number { return this.cbs.push(cb) }
  remove(id: number): void { this.cbs.remove(id) }
}

function perlin(): Image2d {
  const cbs = new Callbacks<Image2d>();
  const scale = new ValueHandleIml(1024);
  const octaves = new ValueHandleIml(1);
  scale.addListener(() => cbs.notify(null));
  octaves.addListener(() => cbs.notify(null));
  const settings = properties([
    rangeProp('Scale', 0, 10 * 1024, scale),
    rangeProp('Octaves', 1, 4, octaves)
  ]);
  const pixel = (stack: VecStack2d, pos: number) => {
    const noise = octaves2d(perlin2d, octaves.get());
    const s = scale.get() / 100;
    return stack.push(noise(stack.get(pos) * s, stack.get(pos + 1) * s), 0);
  }
  const addListener = (cb: (v: Image2d) => void) => cbs.add(cb);
  const removeListener = (id: number) => cbs.remove(id);
  return { pixel, settings, addListener, removeListener, type: Type.VALUE }
}

function circle(): Image2d {
  const cbs = new Callbacks<Image2d>();
  const radius = new ValueHandleIml(50);
  const pow = new ValueHandleIml(0);
  radius.addListener(() => cbs.notify(null));
  pow.addListener(() => cbs.notify(null));
  const settings = properties([
    rangeProp('Radius', 1, 100, radius),
    rangeProp('Power', -100, 100, pow),
  ]);
  const pixel = (stack: VecStack2d, pos: number) => {
    stack.start();
    const r = radius.get() / 100;
    const l = stack.sub(pos, stack.push(0.5, 0.5));
    const v = clamp(r - l, 0, r);
    const p = 1 + pow.get() / 10;
    const pp = p >= 1 ? p : (1 / (2 - p))
    const k = Math.pow(v / r, pp) * r;
    return stack.return(stack.push(k, 0));
  }
  const addListener = (cb: (v: Image2d) => void) => cbs.add(cb);
  const removeListener = (id: number) => cbs.remove(id);
  return { pixel, settings, addListener, removeListener, type: Type.VALUE }
}

function select(p: (name: string) => Image2d, oracle: Oracle<string>): Image2d {
  const cbs = new Callbacks<Image2d>();
  const src = new ValueHandleIml('');
  const from = new ValueHandleIml(0);
  const to = new ValueHandleIml(255);
  src.addListener(() => cbs.notify(null));
  from.addListener(() => cbs.notify(null));
  to.addListener(() => cbs.notify(null));
  const settings = properties([
    listProp('Source', oracle, src),
    rangeProp('From', 0, 255, from),
    rangeProp('To', 0, 255, to),
  ]);
  const pixel = (stack: VecStack2d, pos: number) => {
    const img = p(src.get());
    const value = img.pixel(stack, pos);
    return stack.push(value >= from.get() && value <= to.get() ? 1 : 0, 0);
  }
  const addListener = (cb: (v: Image2d) => void) => cbs.add(cb);
  const removeListener = (id: number) => cbs.remove(id);
  return { pixel, settings, addListener, removeListener, type: Type.VALUE }
}

const CORE = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [0, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],

  [-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2],
  [-2, -1], [2, -1],
  [-2, 0], [2, 0],
  [-2, 1], [2, 1],
  [-2, 2], [-1, 2], [0, 2], [1, 2], [2, 2],
]

function voronoi(p: (name: string) => Image2d, oracle: Oracle<string>): Image2d {
  const cbs = new Callbacks<Image2d>();
  const noise = new ValueHandleIml('');
  const scale = new ValueHandleIml(4);
  noise.addListener(() => cbs.notify(null));
  scale.addListener(() => cbs.notify(null));
  const settings = properties([
    listProp('Noise', oracle, noise),
    rangeProp('Scale', 1, 100, scale)
  ]);
  const pixel = (stack: VecStack2d, pos: number) => {
    stack.start();
    const noiseImage = p(noise.get());
    const s = scale.get();
    const n = stack.scale(pos, s);
    const c = stack.apply(n, Math.floor);
    const f = stack.apply(n, fract);
    const half = stack.push(0.5, 0.5);
    const img = (stack: VecStack2d, pos: number) => noiseImage.pixel(stack, stack.scale(stack.add(c, pos), 1 / s));

    let mind = 8;
    let mini = 0;
    const minr = stack.allocate();

    for (let i = 0; i < 9; i++) {
      stack.start();
      const xy = stack.pushVec(CORE[i]);
      const v = stack.pushVec(hash(img(stack, xy)));
      const r = stack.sub(xy, stack.add(f, v))
      const d = stack.length(r);

      if (d < mind) {
        mind = d;
        mini = i;
        stack.copy(minr, r);
      }
      stack.stop();
    }

    const minxy = stack.pushVec(CORE[mini]);
    mind = 8;
    for (let i = 0; i < 9; i++) {
      stack.start();
      const xy = stack.add(minxy, stack.pushVec(CORE[i]));
      const v = stack.pushVec(hash(img(stack, xy)));
      const r = stack.sub(xy, stack.add(f, stack.add(half, stack.scale(v, 0.5))));
      const dr = stack.sub(r, minr);
      const drl = stack.length(r);
      const nd = drl == 0 ? stack.push(Number.MAX_VALUE, Number.MAX_VALUE) : stack.scale(dr, 1 / drl);
      const sr = stack.scale(stack.add(r, minr), 0.5);
      const d = Math.abs(stack.dot(nd, sr));
      mind = Math.min(d, mind);
      stack.stop();
    }

    return stack.return(stack.push(mind, 0));
  }
  const addListener = (cb: (v: Image2d) => void) => cbs.add(cb);
  const removeListener = (id: number) => cbs.remove(id);
  return { pixel, settings, addListener, removeListener, type: Type.VALUE }
}

function hash(x: number): [number, number] {
  const nx = x / 255;
  return [(0.5 + Math.sin(nx) * 0.5) * 0.8, (0.5 + Math.cos(nx) * 0.5) * 0.8];
  // return [perlin2d(nx, 0), perlin2d(0, nx)];
}

function grad(f: (stack: VecStack2d, pos: number) => number, stack: VecStack2d, pos: number, d: number) {
  stack.start();
  const d1 = stack.get(f(stack, stack.add(pos, stack.push(-d, 0))))[0];
  const d2 = stack.get(f(stack, stack.add(pos, stack.push(d, 0))))[0];
  const d3 = stack.get(f(stack, stack.add(pos, stack.push(0, -d))))[0];
  const d4 = stack.get(f(stack, stack.add(pos, stack.push(0, d))))[0];
  return stack.return(stack.push(d1 - d2, d3 - d4));
}

function displace(p: (name: string) => Image2d, oracle: Oracle<string>): Image2d {
  const cbs = new Callbacks<Image2d>();
  const src = new ValueHandleIml('');
  const displace = new ValueHandleIml('');
  const scale = new ValueHandleIml(100);
  src.addListener(() => cbs.notify(null));
  displace.addListener(() => cbs.notify(null));
  scale.addListener(() => cbs.notify(null));
  const settings = properties([
    listProp('Source', oracle, src),
    listProp('Displace', oracle, displace),
    rangeProp('Scale', -1000, 1000, scale),
  ]);
  const pixel = (stack: VecStack2d, pos: number) => {
    const source = p(src.get());
    const disp = p(displace.get());
    const s = scale.get() * 10000;
    const d = grad(disp.pixel, stack, pos, 0.00001);
    return source.pixel(stack, stack.scale(stack.add(pos, d), s));
  }
  const addListener = (cb: (v: Image2d) => void) => cbs.add(cb);
  const removeListener = (id: number) => cbs.remove(id);
  return { pixel, settings, addListener, removeListener, type: Type.VALUE }
}

function distance2d(sdf: SdfShape<VecStack2d>): Image2d {
  const cbs = new Callbacks<Image2d>();
  const scale = new ValueHandleIml(100);
  scale.addListener(() => cbs.notify(null));
  const settings = properties([
    rangeProp('Scale', 1, 10000, scale),
  ]);

  const pixel = (stack: VecStack2d, pos: number) => {
    stack.start();
    const s = scale.get() / 100;
    const d = sdf(stack, pos);
    return stack.return(stack.apply(stack.scale(d, s), fract));
  }

  const addListener = (cb: (v: Image2d) => void) => cbs.add(cb);
  const removeListener = (id: number) => cbs.remove(id);
  return { pixel, settings, addListener, removeListener, type: Type.VALUE }
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
  private data: Uint8ClampedArray;
  private id: ImageData;
  private renderer: Image2dRenderer;

  private images: Image2d[] = [];
  private imagesModel = new ShapesModel();
  private imageMap = new Map<string, Image2d>();

  constructor(private ui: Ui, private scheduler: Scheduler) {
    this.recreateBuffer();
    this.renderer = new Image2dRenderer(scheduler);
    this.renderer.attach(this.buffer, this.bufferSize, () => this.redraw());

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

    const kdtree = new KDTree([...map(range(0, 100), _ => <[number, number]>[Math.random(), Math.random()])]);
    const line1 = (stack: VecStack2d, p: number) => {
      stack.start();
      const p1 = stack.push(0.5, 0.0);
      const p2 = stack.push(0.5, 1.0);
      const d = lineSegment(stack, p, p1, p2) - 0.01;
      stack.stop();
      return d;
    }
    const line2 = (stack: VecStack2d, p: number) => {
      stack.start();
      const p1 = stack.push(0.0, 0.6);
      const p2 = stack.push(1.0, 0.6);
      const d = lineSegment(stack, p, p1, p2);
      stack.stop();
      return d;
    }
    const lines = (stack: VecStack2d, p: number) => union(stack, p, line1, line2);
    const circular = (stack: VecStack2d, p: number) => { stack.start(); return stack.return(stack.push(circularArray(stack, p, 6, lines), 0)) }

    this.addImage('Circle', circle());
    this.addImage('Perlin', perlin());
    this.addImage('Select', select(this.imageProvider(), this.shapeOracle()));
    this.addImage('Displace', displace(this.imageProvider(), this.shapeOracle()));
    this.addImage('Voronoi', voronoi(this.imageProvider(), this.shapeOracle()));
    this.addImage('Distance', distance2d((stack, p) => stack.push(kdtree.distance(stack.get(p)[0], stack.get(p)[1]), 0)));
    this.addImage('Line', distance2d(circular));
  }

  private imageProvider(): (name: string) => Image2d {
    return s => this.imageMap.get(s);
  }

  private shapeOracle(): Oracle<string> {
    return s => filter(this.imageMap.keys(), k => s.startsWith(s));
  }

  private recreateBuffer() {
    this.buffer = new Array<number>(this.bufferSize * this.bufferSize);
    this.data = new Uint8ClampedArray(640 * 640 * 4);
    this.id = new ImageData(this.data, 640, 640);
  }

  private addImage(name: string, img: Image2d) {
    const id = this.images.length;
    this.images.push(img);
    const item = this.imagesModel.add(name);
    item.setSelect(s => { if (s) this.selectImage(id) })
    this.imageMap.set(name, img);
  }

  private selectImage(id: number) {
    const img = this.images[id];
    if (img == undefined) return;
    replaceContent(this.sidebarRight, img.settings);
    this.renderer.set(img);
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
    grayRasterizer(framed, this.data);
    ctx.putImageData(this.id, 0, 0);
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

    navTree(sidebarleft, this.imagesModel);
    return widget;
  }

  public stop() { this.window.destroy() }
  public show() { this.window.show(); this.redraw() }
}