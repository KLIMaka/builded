import h from "stage0";
import { CallbackChannelImpl, CallbackHandlerImpl, Handle, handle, value } from "../../../utils/callbacks";
import { filter, getOrCreate } from "../../../utils/collections";
import { create, lifecycle, Module, plugin } from "../../../utils/injector";
import { Range, Vec3Interpolator } from "../../../utils/interpolator";
import { clamp, int, len2d } from "../../../utils/mathutils";
import { array, Raster, rect, resize } from "../../../utils/pixelprovider";
import { menuButton, NavItem1, navTree, NavTreeModel, Oracle, properties } from "../../../utils/ui/renderers";
import { addDragController, replaceContent } from "../../../utils/ui/ui";
import { VecStack } from "../../../utils/vecstack";
import { Scheduler, SCHEDULER, TaskHandle } from "../../apis/app";
import { BUS, busDisconnector } from "../../apis/handler";
import { Ui, UI, Window } from "../../apis/ui";
import { namedMessageHandler } from "../../edit/messages";
import { apply, blend, box, circle, circular, displace, displacedGrid, gradient, grid, Image, perlin, pointDistance, Postprocessor, profile, profiles, render, Renderer, repeat, sdf, select, transform, Value, voronoi } from './funcs';

export async function PainterModule(module: Module) {
  module.bind(plugin('Painter'), lifecycle(async (injector, lifecycle) => {
    const bus = await injector.getInstance(BUS);
    const editor = await create(injector, Painter, UI, SCHEDULER);
    lifecycle(bus.connect(namedMessageHandler('show_painter', () => editor.show())), busDisconnector(bus));
    lifecycle(editor, async e => e.stop());
  }));
}

function rasterizer(raster: Raster<number>, out: Uint32Array) {
  const w = raster.width;
  const h = raster.height;
  let off = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      out[off++] = raster.pixel(x, y);
    }
  }
}


class Model {
  private x = 0;
  private y = 0;
  private points: number[] = [];
  private dragged: number;

  constructor(private stack: VecStack, private canvas: HTMLCanvasElement, private cb: () => void) {
    canvas.addEventListener('mousemove', e => this.move(e.offsetX, e.offsetY));
    canvas.addEventListener('mousedown', e => this.drag())
    canvas.addEventListener('mouseup', e => this.drop())
    this.redraw();
  }

  addPoint(pointId: number): void {
    this.points.push(pointId);
    this.redraw();
  }

  private findPoint(): number {
    let minLen = Number.MAX_VALUE;
    let closest = -1;
    for (const p of this.points) {
      const px = this.stack.x(p);
      const py = this.stack.y(p);
      const l = len2d(px - this.x, py - this.y);
      if (l < minLen) {
        minLen = l;
        closest = p;
      }
    }
    return minLen < 0.01 ? closest : -1;
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
      const x = this.stack.x(p) * w;
      const y = this.stack.y(p) * h;
      ctx.beginPath();
      ctx.rect(x - 5, y - 5, 10, 10);
      ctx.closePath();
      if (p == point) ctx.fill();
      else ctx.stroke();
    }
  }

  public drag() {
    const closest = this.findPoint();
    if (closest == -1) return;
    this.dragged = closest;
  }

  public drop() {
    this.dragged = -1;
  }

  public move(x: number, y: number) {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.x = x / w;
    this.y = y / h;

    if (this.dragged != -1) {
      const nx = Math.round(this.x / 0.1) * 0.1;
      const ny = Math.round(this.y / 0.1) * 0.1;
      this.stack
        .setx(this.dragged, nx)
        .sety(this.dragged, ny);
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

const NORMAL = (stack: VecStack, res: number) => {
  const r = 255 * clamp(stack.x(res), 0, 1);
  const g = 255 * clamp(stack.y(res), 0, 1);
  const b = 255 * clamp(stack.z(res), 0, 1);
  const a = 255 * clamp(stack.w(res), 0, 1);
  return r | (g << 8) | (b << 16) | (a << 24);
}

const GRAY_R = (stack: VecStack, res: number) => {
  const r = 255 * clamp(stack.x(res), 0, 1);
  return r | (r << 8) | (r << 16) | (255 << 24);
}

const GREEN_RED = new Range([0, 255, 0], [255, 0, 0], Vec3Interpolator);
const PLUS_MINUS_ONE_R = (stack: VecStack, res: number) => {
  const i = (stack.x(res) + 1) * 0.5;
  const [r, g, b] = GREEN_RED.get(i);
  return r | (g << 8) | (b << 16) | (255 << 24);
}

const VECTOR = (stack: VecStack, res: number) => {
  const r = 255 * (stack.x(res) + 1) * 0.5;
  const g = 255 * (stack.y(res) + 1) * 0.5;
  const b = 255 * (stack.z(res) + 1) * 0.5;
  return r | (g << 8) | (b << 16) | (255 << 24);
}


class Image2dRenderer extends CallbackChannelImpl<[]> {
  private scheduleHandle: TaskHandle;
  private position: number;
  private handler: Handle;

  constructor(private scheduler: Scheduler, private stack: VecStack, private buff: Uint32Array, private size: number, private pp: Value<Postprocessor>) {
    super();
    this.position = this.stack.pushGlobal(0, 0, 0, 0);
  }

  public set(renderer: Value<Renderer>) {
    if (this.handler != null) this.handler.stop();
    this.handler = handle(null, (p, renderer, pp) => this.scheduleRedraw(renderer, pp), renderer, this.pp);
  }

  private scheduleRedraw(renderer: Renderer, pp: Postprocessor) {
    if (this.scheduleHandle != null) this.scheduleHandle.stop();
    this.scheduleHandle = this.scheduler.addTask(this.redraw(renderer, pp));
  }

  private * redraw(renderer: Renderer, pp: Postprocessor) {
    let time = 0;
    let t = window.performance.now();
    let off = 0;
    const size = this.size;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        this.stack.begin();
        this.stack.set(this.position, x / size, y / size, 0, 0);
        const res = this.stack.call(renderer, this.position);
        this.buff[off++] = pp(this.stack, res);
        this.stack.end();
      }
      const dt = window.performance.now() - t;
      if (dt > 100) {
        t = window.performance.now();
        time += dt;
        this.notify();
        yield;
      }
    }
    this.notify();
    console.log(time);
  }
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

  private buffer: Uint32Array;
  private bufferSize = 512;
  private data: Uint8ClampedArray;
  private dataView: Uint32Array;
  private id: ImageData;
  private renderer: Image2dRenderer;
  private stack = new VecStack(1024);

  private images: Image[] = [];
  private imagesModel = new ShapesModel();
  private imageMap = new Map<string, Image>();
  private postprocessors = new Map<Image, Postprocessor>();
  private currentImage = value(<Image>null);
  private settingsHandle = new CallbackHandlerImpl(() => replaceContent(this.sidebarRight, properties(this.currentImage.get().settings.get())));
  private postrocessor = value(NORMAL);

  constructor(private ui: Ui, scheduler: Scheduler) {
    this.recreateBuffer();
    this.renderer = new Image2dRenderer(scheduler, this.stack, this.buffer, this.bufferSize, this.postrocessor);
    this.renderer.add(() => this.redraw());
    this.currentImage.add(() => this.renderer.set(this.currentImage.get().renderer))
    this.postrocessor.add(() => this.postprocessors.set(this.currentImage.get(), this.postrocessor.get()));

    const view = this.createView();
    this.window = ui.builder.window()
      .title('Painter')
      .draggable(true)
      .closeable(true)
      .centered(true)
      .size(1081, 640)
      .content(view)
      .toolbar(ui.builder.toolbar()
        .startGroup()
        .widget(this.createPPMenu())
        .widget(this.createAddMenu())
        .endGroup())
      .build();
  }

  private imageProvider(): (name: string) => Image {
    return s => this.imageMap.get(s);
  }

  private shapeOracle(): Oracle<string> {
    return s => filter(this.imageMap.keys(), k => s.startsWith(s));
  }

  private createPPMenu() {
    const menu = this.ui.builder.menu();
    menu.item('Normal', () => this.postrocessor.set(NORMAL));
    menu.item('Gray R', () => this.postrocessor.set(GRAY_R));
    menu.item('+/-1 R', () => this.postrocessor.set(PLUS_MINUS_ONE_R));
    menu.item('Vector', () => this.postrocessor.set(VECTOR));
    return menuButton('icon-adjust', menu);
  }

  private createAddMenu() {
    let counter = 0;
    const menu = this.ui.builder.menu();
    menu.item('Profiles', () => this.addImage(`Profiles ${counter++}`, profiles()));
    menu.item('Point', () => this.addImage(`Point ${counter++}`, pointDistance()));
    menu.item('SDF', () => this.addImage(`SDF ${counter++}`, sdf(this.imageProvider(), this.shapeOracle())));
    menu.item('Profile', () => this.addImage(`Profile ${counter++}`, profile(this.imageProvider(), this.shapeOracle())));
    menu.item('Circle', () => this.addImage(`Circle ${counter++}`, circle()));
    menu.item('Box', () => this.addImage(`Box ${counter++}`, box(this.imageProvider(), this.shapeOracle())));
    menu.item('Perlin', () => this.addImage(`Perlin ${counter++}`, perlin()));
    menu.item('Select', () => this.addImage(`Select ${counter++}`, select(this.imageProvider(), this.shapeOracle())));
    menu.item('Displace', () => this.addImage(`Displace ${counter++}`, displace(this.imageProvider(), this.shapeOracle())));
    menu.item('Repeat', () => this.addImage(`Repeat ${counter++}`, repeat(this.imageProvider(), this.shapeOracle())));
    menu.item('Circular', () => this.addImage(`Circular ${counter++}`, circular(this.imageProvider(), this.shapeOracle())));
    menu.item('Transform', () => this.addImage(`Transform ${counter++}`, transform(this.imageProvider(), this.shapeOracle())));
    menu.item('Grid', () => this.addImage(`Grid ${counter++}`, grid(this.stack)));
    menu.item('Displaced', () => this.addImage(`Displaced ${counter++}`, displacedGrid(this.stack, this.imageProvider(), this.shapeOracle())));
    menu.item('Apply', () => this.addImage(`Apply ${counter++}`, apply(this.stack, this.imageProvider(), this.shapeOracle())));
    menu.item('Gradient', () => this.addImage(`Gradient ${counter++}`, gradient(this.imageProvider(), this.shapeOracle())));
    menu.item('Blend', () => this.addImage(`Blend ${counter++}`, blend(this.imageProvider(), this.shapeOracle())));
    menu.item('Renderer', () => this.addImage(`Renderer ${counter++}`, render(this.stack, this.imageProvider(), this.shapeOracle())));
    menu.item('Voronoi', () => this.addImage(`Voronoi ${counter++}`, voronoi(this.stack, this.imageProvider(), this.shapeOracle())));
    return menuButton('icon-plus', menu);
  }

  private recreateBuffer() {
    this.buffer = new Uint32Array(this.bufferSize * this.bufferSize);
    this.data = new Uint8ClampedArray(640 * 640 * 4);
    this.dataView = new Uint32Array(this.data.buffer);
    this.id = new ImageData(this.data, 640, 640);
  }

  private addImage(name: string, img: Image) {
    const id = this.images.length;
    this.images.push(img);
    const item = this.imagesModel.add(name);
    item.setSelect(s => { if (s) this.selectImage(id) })
    this.imageMap.set(name, img);
  }

  private selectImage(id: number) {
    const img = this.images[id];
    if (img == undefined) return;
    this.currentImage.set(img);
    this.postrocessor.set(getOrCreate(this.postprocessors, img, _ => NORMAL))
    this.settingsHandle.connect(img.settings);
    replaceContent(this.sidebarRight, properties(img.settings.get()));
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
    rasterizer(framed, this.dataView);
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