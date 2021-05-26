import h from "stage0";
import tippy from "tippy.js";
import { art } from "../../build/artraster";
import { animate, ArtInfoProvider } from "../../build/formats/art";
import { enumerate, forEach, map, range } from "../../utils/collections";
import { drawToCanvas } from "../../utils/imgutils";
import { create, lifecycle, Module, plugin } from "../../utils/injector";
import { iter } from "../../utils/iter";
import { bilinear, biquad, clamp, int, len2d, octaves2d, perlin2d } from "../../utils/mathutils";
import { palRasterizer, Raster, Rasterizer, rect, resize, superResize, transform } from "../../utils/pixelprovider";
import { DrawPanel, RasterProvider } from "../../utils/ui/drawpanel";
import { menuButton, NavItem, NavItem1, navTree, NavTreeModel, properties, rangeProp, search, sliderToolbarButton, textProp, ValueHandleIml } from "../../utils/ui/renderers";
import { addDragController, div, replaceContent } from "../../utils/ui/ui";
import { ART, Scheduler, SCHEDULER, SchedulerTask, TaskHandle } from "../apis/app";
import { BUS, busDisconnector } from "../apis/handler";
import { Ui, UI, Window } from "../apis/ui";
import { namedMessageHandler } from "../edit/messages";
import { PicNumCallback } from "../edit/tools/selection";
import { Palette, PicTags, PIC_TAGS, RAW_PAL, RAW_PLUs, TRANS_TABLE } from "./artselector";
import { SHADOWSTEPS } from "./gl/buildgl";
import { Sdf, sdf, softShadow, sintersect, ssub, sub, sunion, union, ambientOcclusion, lambert, normal, sphere } from "../../app/modules/sdf/sdfraster";
import { vec2, vec3, Vec3Array } from "../../libs_js/glmatrix";
import { VecStack3d } from "../../utils/vecstack";
import { NumberInterpolator } from "../../utils/interpolator";


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

class Model1Item implements NavItem1 {
  private selectCallback: (select: boolean) => void;

  constructor(public title: string) { }

  setSelect(cb: (select: boolean) => void) { this.selectCallback = cb }
  select(selected: boolean) { this.selectCallback(selected) }
}

class Model1 implements NavTreeModel {
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
  }
}


class Painter {
  private window: Window;
  private display: HTMLCanvasElement;
  private overlay: HTMLCanvasElement;
  private sidebarRight: HTMLElement;
  private sidebarLeft: HTMLElement;
  private model: Model;
  private handle: TaskHandle;
  private center1: number;
  private center2: number;
  private light: number;

  private ambientValue = new ValueHandleIml(20);
  private lightValue = new ValueHandleIml(160);
  private shadowHardness = new ValueHandleIml(16);

  private noise = octaves2d(perlin2d, 4);

  constructor(private ui: Ui, private scheduler: Scheduler) {
    const view = this.createView();
    this.model = new Model(this.overlay, () => this.redraw());
    this.window = ui.builder.window()
      .title('Painter')
      .draggable(true)
      .closeable(true)
      .centered(true)
      .size(1081, 640)
      .content(view)
      .toolbar(ui.builder.toolbar()
        .startGroup()
        .widget(this.createAmbientSlider())
        .widget(this.createLightSlider())
        .widget(this.createShadowHardnessSlider())
        .endGroup()
      )
      .build();

    this.center1 = this.model.addPoint(0.3, 0.5, 0.5);
    this.center2 = this.model.addPoint(0.7, 0.5, 0.5);
    this.light = this.model.addPoint(0.5, 0.0, 0.0);

    this.ambientValue.addListener(v => this.redraw());
    this.lightValue.addListener(v => this.redraw());
    this.shadowHardness.addListener(v => this.redraw());
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

    const shapes = new Model1();
    navTree(sidebarleft, shapes);
    shapes.add('Shape1')
    shapes.add('Shape2')
    shapes.add('Shape3')
    shapes.add('Shape4')

    replaceContent(this.sidebarRight,
      properties([
        rangeProp('Ambient', 0, 255, this.ambientValue),
        rangeProp('Light', 0, 255, this.lightValue),
        rangeProp('Shadows', 1, 128, this.shadowHardness)
      ]));
    return widget;
  }

  private createAmbientSlider() {
    return sliderToolbarButton({ label: "Ambient", min: 0, max: 255, handle: this.ambientValue })
  }

  private createLightSlider() {
    return sliderToolbarButton({ label: "Light", min: 0, max: 255, handle: this.lightValue })
  }

  private createShadowHardnessSlider() {
    return sliderToolbarButton({ label: "Shadow Hardness", min: 1, max: 128, handle: this.shadowHardness })
  }

  private redraw() {
    if (this.handle != null) this.handle.stop();
    this.handle = this.scheduler.addTask(this.render());
  }

  private * render(): SchedulerTask {
    const ctx = this.display.getContext('2d');
    const vecs = new VecStack3d(128);
    const center1 = vecs.pushVec(this.model.getPoint(this.center1));
    const center2 = vecs.pushVec(this.model.getPoint(this.center2));
    const light = vecs.pushVec(this.model.getPoint(this.light));
    const s: Sdf<number> = {
      dist: (vecs: VecStack3d, pos: number) =>
        ssub(vecs, pos,
          (vecs, p) => sphere(vecs, p, center2, 0.2),
          (vecs, p) => sunion(vecs, p,
            (vecs, p) => sphere(vecs, p, center1, 0.2),
            (vecs, p) => 0.5 - 0.05 * this.noise(vecs.get(p)[0] * 16, vecs.get(p)[1] * 16) - vecs.get(p)[2], 0.04), 0.004),

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

    // let handle = yield;
    // const img = sdf(vecs.start(), 640, 640, s, 0);
    // drawToCanvas(img, ctx, grayRasterizer(10));
    // vecs.stop();
    // handle = yield;
    // for (let y = 0; y < 10; y++) {
    //   for (let x = 0; x < 10; x++) {
    //     const img = sdf(vecs.start(), 64, 64, s, 0, x * 64, y * 64, 10);
    //     drawToCanvas(img, ctx, grayRasterizer(1), x * 64, y * 64);
    //     vecs.stop();
    //     handle.setProgress(x + y * 10);
    //     handle = yield;
    //   }
    // }
    const n = biquad(16, 16, [...map(range(0, 16 * 16), i => Math.random())]);
    drawToCanvas({ width: 640, height: 640, pixel: (x, y) => n(x / 640, y / 640) * 256 }, ctx, grayRasterizer(1));
  }

  public stop() { this.window.destroy() }
  public show() { this.window.show(); this.redraw() }
}