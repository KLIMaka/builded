import h from "stage0";
import { ambientOcclusion, lambert, normal, sdf, Sdf, softShadow, sphere, ssub, sunion } from "../../app/modules/sdf/sdfraster";
import { vec3, Vec3Array } from "../../libs_js/glmatrix";
import { map, range } from "../../utils/collections";
import { drawToCanvas } from "../../utils/imgutils";
import { create, lifecycle, Module, plugin } from "../../utils/injector";
import { clamp, int, len2d, octaves2d, perlin2d } from "../../utils/mathutils";
import { Raster, Rasterizer, array, resize, rect } from "../../utils/pixelprovider";
import { listProp, NavItem1, navTree, NavTreeModel, properties, rangeProp, sliderToolbarButton, ValueHandleIml } from "../../utils/ui/renderers";
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
  private selectCallback: (select: boolean) => void;

  constructor(public title: string) { }

  setSelect(cb: (select: boolean) => void) { this.selectCallback = cb }
  select(selected: boolean) { this.selectCallback(selected) }
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
  private bufferSize = 128;

  private shapes: Shape[] = [];
  private currentShape: string;
  private shapesModel = new ShapesModel();
  private shapeRefs: Model1Item[] = [];

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
  }

  private recreateBuffer() {
    this.buffer = new Array<number>(this.bufferSize * this.bufferSize);
    // this.buffer = [...map(range(0, this.bufferSize * this.bufferSize), i => {
    //   const [x, y] = [i % this.bufferSize, i / this.bufferSize];
    //   return 127 + 127 * perlin2d(x, y);
    // })];
  }

  private addShape(name: string, shape: Shape) {
    this.shapes.push(shape);
    this.shapeRefs.push(this.shapesModel.add(name));
  }

  private selectShape(name: string) {
    const shape = this.shapes.get(name);
    const lastShape = this.shapes.get(this.currentShape);
    if (shape == undefined) return;
    if (lastShape != undefined) lastShape.remove();
    this.currentShape = name;
    replaceContent(this.sidebarRight, shape.settings);
    shape.attach(this.buffer, this.bufferSize, () => this.redraw());
    this.shapesModel.select()
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

    // replaceContent(this.sidebarRight,
    //   properties([
    //     rangeProp('Ambient', 0, 255, this.ambientValue),
    //     rangeProp('Light', 0, 255, this.lightValue),
    //     rangeProp('Shadows', 1, 128, this.shadowHardness),
    //     listProp('List', this.fff)
    //   ]));
    return widget;
  }


  private * render(): SchedulerTask {
    const ctx = this.display.getContext('2d');
    const vecs = new VecStack3d(128);
    const center1 = vecs.pushVec(this.model.getPoint(this.center1));
    const center2 = vecs.pushVec(this.model.getPoint(this.center2));
    const light = vecs.pushVec(this.model.getPoint(this.light));

    const s: Sdf<number> = {
      dist: (vecs: VecStack3d, pos: number) =>
        ssub(0.04)(vecs, pos,
          (vecs, p) => sphere(vecs, p, center2, 0.2),
          (vecs, p) => sunion(0.04)(vecs, p,
            (vecs, p) => sphere(vecs, p, center1, 0.2),
            (vecs, p) => 0.5 - 0.05 * this.noise(vecs.get(p)[0] * 16, vecs.get(p)[1] * 16) - vecs.get(p)[2])),

      color: (vecs: VecStack3d, pos: number) => {
        vecs.start();
        const n = normal(vecs, pos, s.dist);
        const toLight = vecs.normalized(vecs.sub(light, vecs.push(0.5, 0.5, 0.5)));
        const shadow = softShadow(this.shadowHardness.get(), vecs, pos, toLight, s.dist);
        const ao = ambientOcclusion(vecs, pos, n, s.dist);
        const lamb = lambert(vecs, n, toLight);
        vecs.stop();
        const ambient = this.ambientValue.get() * ao;
        const diffuse = this.lightValue.get() * shadow * lamb;
        return int(clamp(ambient + diffuse, 0, 255));
      }
    }

    let handle = yield;
    const img = sdf(vecs.start(), 640, 640, s, 0);
    drawToCanvas(img, ctx, grayRasterizer(10));
    vecs.stop();
    handle = yield;
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        const img = sdf(vecs.start(), 64, 64, s, 0, x * 64, y * 64, 10);
        drawToCanvas(img, ctx, grayRasterizer(1), x * 64, y * 64);
        vecs.stop();
        handle.setProgress(x + y * 10);
        handle = yield;
      }
    }
    // const n = biquad(16, 16, [...map(range(0, 16 * 16), i => Math.random())]);
    // drawToCanvas({ width: 640, height: 640, pixel: (x, y) => n(x / 640, y / 640) * 256 }, ctx, grayRasterizer(1));
  }

  public stop() { this.window.destroy() }
  public show() { this.window.show(); this.redraw() }
}