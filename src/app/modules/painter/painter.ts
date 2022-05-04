import h from "stage0";
import { CallbackChannelImpl, CallbackHandlerImpl, Handle, handle, transformed, value } from "../../../utils/callbacks";
import { getOrCreate } from "../../../utils/collections";
import { create, lifecycle, Module, plugin } from "../../../utils/injector";
import { Range, Vec3Interpolator } from "../../../utils/interpolator";
import { iter } from "../../../utils/iter";
import { int, normalize, vec42int } from "../../../utils/mathutils";
import { f32array, Mapper } from "../../../utils/pixelprovider";
import { Oracle } from "../../../utils/ui/controls/api";
import { listBox } from "../../../utils/ui/controls/listbox";
import { menuButton, NavItem1, navTree, NavTreeModel, properties } from "../../../utils/ui/renderers";
import { replaceContent } from "../../../utils/ui/ui";
import { VecStack } from "../../../utils/vecstack";
import { Scheduler, SCHEDULER, TaskHandle } from "../../apis/app";
import { BUS, busDisconnector } from "../../apis/handler";
import { Ui, UI, Window } from "../../apis/ui";
import { namedMessageHandler } from "../../edit/messages";
import { Context, Image, Renderer, Value } from "./api";
import { apply, blend, box, circle, circular, displace, displacedGrid, gradient, grid, mouldings, perlin, pointDistance, profile, profiles, render, repeat, sdf, select, transform, voronoi } from './funcs/catalog';
import { rasterWorkplaneRenderer, renderGrid, Workplane, WorkplaneRendererBuilder } from "./workplane";

export async function PainterModule(module: Module) {
  module.bind(plugin('Painter'), lifecycle(async (injector, lifecycle) => {
    const bus = await injector.getInstance(BUS);
    const editor = await create(injector, Painter, UI, SCHEDULER);
    lifecycle(bus.connect(namedMessageHandler('show_painter', () => editor.show())), busDisconnector(bus));
    lifecycle(editor, async e => e.stop());
  }));
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


const GREEN_RED = new Range([0, 255, 0], [255, 0, 0], Vec3Interpolator);
type Limiter = (r: number, g: number, b: number, a: number) => number;

class Image2dRenderer extends CallbackChannelImpl<[]> {
  private scheduleHandle: TaskHandle;
  private position: number;
  private handler: Handle;
  public mins = [0, 0, 0, 0];
  public maxs = [0, 0, 0, 0];

  constructor(private scheduler: Scheduler, private stack: VecStack, private buff: Float32Array, private size: number) {
    super();
    this.position = this.stack.pushGlobal(0, 0, 0, 0);
  }

  public set(renderer: Value<Renderer>) {
    if (this.handler != null) this.handler.stop();
    this.handler = handle(null, (p, renderer) => this.scheduleRedraw(renderer), renderer);
  }

  private scheduleRedraw(renderer: Renderer) {
    if (this.scheduleHandle != null) this.scheduleHandle.stop();
    this.scheduleHandle = this.scheduler.addTask(this.redraw(renderer));
  }

  private updateStats(r: number, g: number, b: number, a: number) {
    this.maxs[0] = Math.max(this.maxs[0], r);
    this.maxs[1] = Math.max(this.maxs[1], g);
    this.maxs[2] = Math.max(this.maxs[2], b);
    this.maxs[3] = Math.max(this.maxs[3], a);
    this.mins[0] = Math.min(this.mins[0], r);
    this.mins[1] = Math.min(this.mins[1], g);
    this.mins[2] = Math.min(this.mins[2], b);
    this.mins[3] = Math.min(this.mins[3], a);
  }

  private resetStats() {
    this.mins = [0, 0, 0, 0];
    this.maxs = [0, 0, 0, 0];
  }

  private * redraw(renderer: Renderer) {
    let t = window.performance.now();
    const start = t;
    this.resetStats();
    const size = this.size;
    const ds = 0.5 / size;
    const max = size * size;
    for (let i = 0; i < max; i++) {
      const off = (i * 71129) % max;
      const x = int(off % size);
      const y = int(off / size);
      this.stack.begin();
      this.stack.set(this.position, x / size + ds, y / size + ds, 0, 0);
      const res = this.stack.call(renderer, this.position);
      const r = this.stack.x(res);
      const g = this.stack.y(res);
      const b = this.stack.z(res);
      const a = this.stack.w(res);
      this.stack.end();
      this.updateStats(r, g, b, a);

      const ptr = off * 4;
      this.buff[ptr] = r;
      this.buff[ptr + 1] = g;
      this.buff[ptr + 2] = b;
      this.buff[ptr + 3] = a;

      if (i % 512 == 0) {
        const dt = window.performance.now() - t;
        if (dt > 100) {
          t = window.performance.now();
          this.notify();
          yield;
        }
      }
    }
    this.notify();
    console.log(window.performance.now() - start);
  }
}



class Painter implements Context {
  private window: Window;
  private sidebarRight: HTMLElement;
  private sidebarLeft: HTMLElement;

  private buffer: Float32Array;
  private bufferSize = 512;
  private workplane: Workplane;
  private renderer: Image2dRenderer;
  private _stack = new VecStack(1024);

  private readonly NORMAL = this.createNormal();
  private readonly GRAY_R = this.createGrayR();
  private readonly PLUS_MINUS_ONE_R = this.createPlusMinusOneR();
  private readonly VECTOR = this.createVector();

  private images: Image[] = [];
  private imagesModel = new ShapesModel();
  private imageMap = new Map<string, Image>();
  private limiters = new Map<Image, Limiter>();
  private currentImage = value(<Image>null);
  private _currentImageName = '';
  private settingsHandle = new CallbackHandlerImpl(() => replaceContent(this.sidebarRight, properties(this.currentImage.get().settings.get())));
  private limiter = value(this.GRAY_R);
  private mapper: Mapper = (r, g, b, a) => this.limiter.get()(r, g, b, a);
  private shapesLib = this.initShapes();

  private gridSizeName = value("128");
  private gridSize = transformed(this.gridSizeName, Number.parseInt);

  constructor(private ui: Ui, scheduler: Scheduler) {
    this.recreateBuffer();
    this.renderer = new Image2dRenderer(scheduler, this._stack, this.buffer, this.bufferSize);
    this.renderer.add(() => this.redraw());
    this.currentImage.add(() => this.renderer.set(this.currentImage.get().renderer))
    this.limiter.add(() => { this.limiters.set(this.currentImage.get(), this.limiter.get()); this.workplane.redraw() });

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
        .widget(this.createPopup())
        .iconButton('icon-resize-small', () => this.workplane.update(64, 64, 1))
        .endGroup()
        .widget(this.createGridSizeControl()))
      .build();
  }

  private createPPMenu() {
    const menu = this.ui.builder.menu();
    menu.item('Normal', () => this.limiter.set(this.NORMAL));
    menu.item('Gray R', () => this.limiter.set(this.GRAY_R));
    menu.item('+/-1 R', () => this.limiter.set(this.PLUS_MINUS_ONE_R));
    menu.item('Vector', () => this.limiter.set(this.VECTOR));
    return menuButton('icon-adjust', menu);
  }

  private initShapes(): Map<string, () => void> {
    const map = new Map<string, () => void>();
    let counter = 0;
    map.set('Profiles', () => this.addImage(`Profiles ${counter++}`, profiles(this)));
    map.set('Point', () => this.addImage(`Point ${counter++}`, pointDistance(this)));
    map.set('SDF', () => this.addImage(`SDF ${counter++}`, sdf(this)));
    map.set('Profile', () => this.addImage(`Profile ${counter++}`, profile(this)));
    map.set('Circle', () => this.addImage(`Circle ${counter++}`, circle(this)));
    map.set('Box', () => this.addImage(`Box ${counter++}`, box(this)));
    map.set('Perlin', () => this.addImage(`Perlin ${counter++}`, perlin(this)));
    map.set('Select', () => this.addImage(`Select ${counter++}`, select(this)));
    map.set('Displace', () => this.addImage(`Displace ${counter++}`, displace(this)));
    map.set('Repeat', () => this.addImage(`Repeat ${counter++}`, repeat(this)));
    map.set('Circular', () => this.addImage(`Circular ${counter++}`, circular(this)));
    map.set('Transform', () => this.addImage(`Transform ${counter++}`, transform(this)));
    map.set('Grid', () => this.addImage(`Grid ${counter++}`, grid(this)));
    map.set('Displaced', () => this.addImage(`Displaced ${counter++}`, displacedGrid(this)));
    map.set('Apply', () => this.addImage(`Apply ${counter++}`, apply(this)));
    map.set('Gradient', () => this.addImage(`Gradient ${counter++}`, gradient(this)));
    map.set('Blend', () => this.addImage(`Blend ${counter++}`, blend(this)));
    map.set('Renderer', () => this.addImage(`Renderer ${counter++}`, render(this)));
    map.set('Voronoi', () => this.addImage(`Voronoi ${counter++}`, voronoi(this)));
    map.set('Mouldings', () => this.addImage(`Mouldings ${counter++}`, mouldings(this)));
    return map;
  }

  private createAddMenu() {
    const menu = this.ui.builder.menu();
    for (const [name, action] of this.shapesLib) menu.item(name, action);
    return menuButton('icon-plus', menu);
  }

  private recreateBuffer() {
    this.buffer = new Float32Array(this.bufferSize * this.bufferSize * 4);
  }

  private addImage(name: string, img: Image) {
    const id = this.images.length;
    this.images.push(img);
    const item = this.imagesModel.add(name);
    item.setSelect(s => { if (s) this.selectImage(id, name) });
    this.imageMap.set(name, img);
    this.imagesModel.select(item);
  }

  private selectImage(id: number, name: string) {
    const img = this.images[id];
    if (img == undefined) return;
    this._currentImageName = name;
    this.currentImage.set(img);
    this.limiter.set(getOrCreate(this.limiters, img, _ => this.GRAY_R))
    this.settingsHandle.connect(img.settings);
    replaceContent(this.sidebarRight, properties(img.settings.get()));
  }

  private createPopup() {
    const oracle = (s: string) => iter(this.shapesLib.keys()).filter(i => i.toLowerCase().startsWith(s.toLowerCase()));
    const name = value('');
    const handle = transformed(name, v => this.shapesLib.get(v));
    handle.add(() => { const a = handle.get(); if (a) { a(); name.set("") } });
    return listBox("Shape", "icon-plus", oracle, name, true);
  }

  private redraw() {
    this.workplane.redraw();
  }

  private createNormal(): Limiter {
    return (r, g, b, a) => {
      return vec42int(
        normalize(r, this.renderer.mins[0], this.renderer.maxs[0]) * 255,
        normalize(g, this.renderer.mins[1], this.renderer.maxs[1]) * 255,
        normalize(b, this.renderer.mins[2], this.renderer.maxs[2]) * 255,
        255);
    };
  }

  private createGrayR(): Limiter {
    return (r, g, b, a) => {
      const v = normalize(r, this.renderer.mins[0], this.renderer.maxs[0]) * 255;
      return vec42int(v, v, v, 255);
    };
  }

  private createPlusMinusOneR(): Limiter {
    return (r, g, b, a) => {
      const v = normalize(r, -1, 1);
      const [r_, g_, b_] = GREEN_RED.get(v);
      return vec42int(r_, g_, b_, 255);
    };
  }

  private createVector(): Limiter {
    return (r, g, b, a) => {
      return vec42int(
        normalize(r, -1, 1) * 255,
        normalize(g, -1, 1) * 255,
        normalize(b, -1, 1) * 255,
        255);
    };
  }

  private createView(): HTMLElement {
    const template = h` 
    <div class='pane-group'>
      <div class='pane pane-sm sidebar' #sidebarleft></div>
      <div class='pane' style="position: relative;" #holder></div>
      <div class='pane pane-sm sidebar' #sidebarright></div>
    </div>`;
    const widget = <HTMLElement>template.cloneNode(true);
    const { holder, sidebarleft, sidebarright } = template.collect(widget);
    this.sidebarLeft = sidebarleft;
    this.sidebarRight = sidebarright;
    this.workplane = new Workplane(640, 640, [
      rasterWorkplaneRenderer(f32array(this.buffer, this.bufferSize, this.bufferSize, this.mapper)),
      this.createGridRenderer()
    ]);
    this.workplane.update(64, 64, 1);
    holder.appendChild(this.workplane.getWidget());

    navTree(sidebarleft, this.imagesModel);
    return widget;
  }

  private createGridRenderer(): WorkplaneRendererBuilder {
    return (canvas, ctx) => {
      const renderer = () => renderGrid(canvas, ctx, this.gridSize.get());
      this.gridSize.add(() => renderer());
      return renderer;
    }
  }

  private createGridSizeControl() {
    const sizes = ["0", "64", "128", "170", "256"];
    const oracle = (s: string) => sizes;
    return listBox("", "icon-plus", oracle, this.gridSizeName);
  }


  public stack(): VecStack { return this._stack }
  public currentImageName(): string { return this._currentImageName }
  public imageProvider(): (name: string) => Image { return s => this.imageMap.get(s) }

  public oracle(img: Image): Oracle<string> {
    return s =>
      iter(this.imageMap.entries())
        .filter(ent => ent[0].startsWith(s) && !ent[1].dependsOn(img))
        .map(e => e[0])
  }

  public stop() { this.window.destroy() }
  public show() { this.window.show(); this.redraw() }
}