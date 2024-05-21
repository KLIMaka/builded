import { cyclicToggler } from "@utils/objects";
import { Consumer, Supplier, nil } from "@utils/types";
import { Action, ActionDescriptors } from "app/apis/actions";
import { Scheduler, TaskController, TaskHandle } from "app/apis/app1";
// import { CallbackChannelImpl, transformed, value } from "../../../utils/callbacks";
import { chain, getOrCreate, mapBuilder } from "../../../utils/collections";
import { Range, Vec3Interpolator } from "../../../utils/interpolator";
import { iter } from "../../../utils/iter";
import { int, normalize, vec42int } from "../../../utils/mathutils";
import { Mapper, f32array } from "../../../utils/pixelprovider";
import { propSections } from "../../../utils/ui/renderers";
import { VecStack } from "../../../utils/vecstack";
import { Block, TableModel, Ui, Widget, Window, WindowBuilder, blockActions, clazz, style } from "../../apis/ui";
import { column, listBuilder, singleActionWidget, suggestionBox, table } from "../ui/builders";
import { Context, Image, PropertySection, Renderer, Value } from "./api";
import catalog from './funcs/catalog';
import { Workplane, WorkplaneRendererBuilder, rasterWorkplaneRenderer, renderGrid } from "./workplane";
import { printTime } from "@utils/time";

const GREEN_RED = new Range([0, 255, 0], [255, 0, 0], Vec3Interpolator);
type Limiter = (r: number, g: number, b: number, a: number) => number;

type ProgressHandler = {
  progress: Consumer<number>,
  onEnd: Consumer<void>,
  onStart: Consumer<TaskController>
}

class Image2dRenderer extends CallbackChannelImpl<void> {
  private scheduleHandle: TaskController;
  private position: number;
  private handler = new CallbackHandlerImpl<Renderer>(r => this.scheduleRedraw(r));
  public mins = [0, 0, 0, 0];
  public maxs = [0, 0, 0, 0];

  constructor(
    private scheduler: Scheduler,
    private stack: VecStack,
    private buff: Float32Array,
    private size: number,
    private progressHandler: ProgressHandler
  ) {
    super();
    this.position = this.stack.pushGlobal(0, 0, 0, 0);
  }

  public set(renderer: Value<Renderer>) {
    this.handler.connect(renderer);
  }

  private scheduleRedraw(renderer: Renderer) {
    if (this.scheduleHandle != null) {
      this.scheduleHandle.stop().finally(() => {
        this.progressHandler.onEnd();
        this.scheduleHandle = null;
        this.scheduleRedraw(renderer)
      });
      return;
    }
    this.scheduleHandle = this.scheduler.exec(handle => this.redrawImpl(handle, renderer));
    this.progressHandler.onStart(this.scheduleHandle);
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

  private async redrawImpl(handle: TaskHandle, renderer: Renderer) {
    return this.redraw(handle, renderer).catch(nil()).finally(() => {
      this.progressHandler.onEnd();
      this.scheduleHandle = null;
    });
  }

  private async redraw(handle: TaskHandle, renderer: Renderer) {
    let t = window.performance.now();
    this.resetStats();
    this.buff.fill(0);
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
        if (dt > 50) {
          t = window.performance.now();
          this.progressHandler.progress(i / max);
          this.notify();
          await handle.wait();
        }
      }
    }
    this.notify();
  }
}

export class Painter implements Context {
  private window: Window;
  private sidebarRight: Block;

  private buffer: Float32Array;
  private bufferSize = 512;
  private workplane: Workplane;
  private renderer: Image2dRenderer;
  private _stack = new VecStack(1024);

  private readonly NORMAL = this.createNormal();
  private readonly GRAY_R = this.createGrayR();
  private readonly PLUS_MINUS_ONE_R = this.createPlusMinusOneR();
  private readonly VECTOR = this.createVector();

  private imagesList: Image[] = [];
  private imagesTable: TableModel<[number, string, Image]>;
  private imageMap = new Map<string, Image>();
  private limiters = new Map<Image, Limiter>();
  private currentImage = value<Image>(null);
  private _currentImageName = '';
  private settingsHandler = new CallbackHandlerImpl<PropertySection[]>(props => this.sidebarRight.replace(propSections(this._ui, props)));
  private limiter = value(this.GRAY_R);
  private mapper: Mapper = (r, g, b, a) => this.limiter.get()(r, g, b, a);
  private shapesLib = this.initShapes();

  private gridSizeName = value("0");
  private gridSize = transformed(this.gridSizeName, Number.parseInt);

  private actionsContext: ActionDescriptors;
  private actions: Action[] = [];

  private progressLabel: Block;
  private progressStartPauseButton: Block;
  private progressStopButton: Block;
  private progressLastStart = 0;
  private progressPaused = false;
  private progressTaskController: TaskController;

  constructor(private _ui: Ui, actions: ActionDescriptors, scheduler: Scheduler) {
    this.actionsContext = actions.sub('painter');
    this.buffer = this.createBuffer();
    this.renderer = new Image2dRenderer(scheduler, this._stack, this.buffer, this.bufferSize, this.createProgressHandler());
    this.renderer.subscribe(_ => this.redraw());
    this.currentImage.subscribe(img => this.renderer.set(img.renderer))
    this.limiter.subscribe(lmt => { this.limiters.set(this.currentImage.get(), lmt); this.redraw() });

    const builder = new WindowBuilder()
      .title(_ui.block().text('Painter'))
      .size(1100, 600)
      .actionsProvider(() => this.actionsImpl())
      .content(_ui.column()
        .widget(_ui.row(['window-toolbar'])
          .insert(this.createImageControl())
          .insert(this.modeControl())
          .insert(this.gridControl()))
        .widget(this.createView(), '1')
        .asWidget())
      .footer(_ui.row()
        .insert(this.createProgressBar())
        .asWidget());
    this.window = _ui.createWindow(builder);
  }

  ui(): Ui { return this._ui }

  private actionsImpl(): Iterable<Action> {
    return chain(this.imagesTable.actions(), this.actions)
  }

  private modeControl(): Block {
    const modes = mapBuilder<Limiter, string>()
      .add(this.NORMAL, 'Normal')
      .add(this.GRAY_R, 'Gray R')
      .add(this.PLUS_MINUS_ONE_R, '+1/-1 R')
      .add(this.VECTOR, 'Vector')
      .build();
    const modesToggler = cyclicToggler([...modes.keys()], this.limiter.get());
    this.limiter.subscribe(l => modesToggler.set(l));
    const box = listBuilder(this._ui, this.limiter)
      .items([...modes.keys()])
      .labelMod(style.width('90px'))
      .renderer(l => modes.get(l))
      .labelPrefix('Mode :')
      .build();
    this.actions.push(this.actionsContext.bind('toggle-mode', async () => this.limiter.set(modesToggler.toggleNext())))
    return box;
  }

  private initShapes(): Map<string, () => void> {
    const map = new Map<string, () => void>();
    let counter = 0;
    map.set('Profiles', () => this.addImage(`Profiles ${counter++}`, catalog.profiles(this)));
    map.set('Point', () => this.addImage(`Point ${counter++}`, catalog.pointDistance(this)));
    map.set('SDF', () => this.addImage(`SDF ${counter++}`, catalog.sdf(this)));
    map.set('Profile', () => this.addImage(`Profile ${counter++}`, catalog.profile(this)));
    map.set('Circle', () => this.addImage(`Circle ${counter++}`, catalog.circle(this)));
    map.set('Box', () => this.addImage(`Box ${counter++}`, catalog.box(this)));
    map.set('Perlin', () => this.addImage(`Perlin ${counter++}`, catalog.perlin(this)));
    map.set('Select', () => this.addImage(`Select ${counter++}`, catalog.select(this)));
    map.set('Displace', () => this.addImage(`Displace ${counter++}`, catalog.displace(this)));
    map.set('Repeat', () => this.addImage(`Repeat ${counter++}`, catalog.repeat(this)));
    map.set('Circular', () => this.addImage(`Circular ${counter++}`, catalog.circular(this)));
    map.set('Transform', () => this.addImage(`Transform ${counter++}`, catalog.transform(this)));
    map.set('Grid', () => this.addImage(`Grid ${counter++}`, catalog.grid(this)));
    map.set('Displaced', () => this.addImage(`Displaced ${counter++}`, catalog.displacedGrid(this)));
    map.set('Apply', () => this.addImage(`Apply ${counter++}`, catalog.apply(this)));
    map.set('Gradient', () => this.addImage(`Gradient ${counter++}`, catalog.gradient(this)));
    map.set('Blend', () => this.addImage(`Blend ${counter++}`, catalog.blend(this)));
    map.set('Renderer', () => this.addImage(`Renderer ${counter++}`, catalog.render(this)));
    map.set('Voronoi', () => this.addImage(`Voronoi ${counter++}`, catalog.voronoi(this)));
    map.set('Mouldings', () => this.addImage(`Mouldings ${counter++}`, catalog.mouldings(this)));
    return map;
  }

  private createBuffer() {
    return new Float32Array(this.bufferSize * this.bufferSize * 4);
  }

  private addImage(name: string, img: Image) {
    const id = this.imagesList.length;
    this.imagesList.push(img);
    this.imagesTable.addRow([id, name, img]);
    this.imageMap.set(name, img);
    this.selectImage(id, name);
  }

  private selectImage(id: number, name: string) {
    const img = this.imagesList[id];
    if (img == undefined) return;
    this._currentImageName = name;
    this.currentImage.set(img);
    this.limiter.set(getOrCreate(this.limiters, img, _ => this.GRAY_R))
    this.settingsHandler.connect(img.settings);
    this.imagesTable.selectRow(id);
  }

  private createImageControl() {
    const label = this._ui.block().text('Add Node...').mod(style.width('80px'));
    const widgets = iter(this.shapesLib.entries()).toMap(
      ([n, _]) => n.toLowerCase(),
      ([n, a]) => singleActionWidget(this._ui.block().text(n), async () => a()));
    const oracle = (s: string) => iter(widgets.entries()).filter(([n, _]) => n.startsWith(s.toLowerCase())).map(([_, w]) => w);
    const box = suggestionBox(this._ui, label, oracle);
    this.actions.push(this.actionsContext.bind('add-shape', async () => { box.mod(e => e.click()) }));
    return box;
  }

  private createProgressHandler(): ProgressHandler {
    return {
      progress: p => this.setProgress(p),
      onStart: ctl => this.startRendering(ctl),
      onEnd: () => this.finishRendering(),
    }
  }

  private createProgressBar(): Block {
    this.progressLabel = this._ui.block().text('');
    this.progressStartPauseButton = this._ui.block('icon', 'icon-pause', 'hidden')
      .event('click', () => {
        if (this.progressPaused) {
          this.progressStartPauseButton
            .mod(clazz.toggle('icon-pause'))
            .mod(clazz.toggle('icon-play'))
          this.progressPaused = false;
          this.progressTaskController.unpause();
        } else {
          this.progressStartPauseButton
            .mod(clazz.toggle('icon-pause'))
            .mod(clazz.toggle('icon-play'))
          this.progressPaused = true;
          this.progressTaskController.pause();
        }
      });
    this.progressStopButton = this._ui.block('icon', 'icon-stop', 'hidden')
      .event('click', () => { this.progressTaskController?.stop(); this.finishRendering() });
    return this._ui.row(['baseline-aligned', 'padded-5'])
      .insert(this.progressLabel)
      .insert(this.progressStartPauseButton)
      .insert(this.progressStopButton)
      .asWidget();
  }

  finishRendering(): void {
    this.progressLabel.text(`Finished in :${printTime(window.performance.now() - this.progressLastStart)}`)
    this.progressStartPauseButton.mod(clazz.add('hidden'));
    this.progressStopButton.mod(clazz.add('hidden'));
  }

  startRendering(controller: TaskController): void {
    this.progressLastStart = window.performance.now();
    this.progressStartPauseButton.mod(clazz.remove('hidden'));
    this.progressStopButton.mod(clazz.remove('hidden'));
    this.progressPaused = false;
    this.progressStartPauseButton
      .mod(clazz.remove('icon-play'))
      .mod(clazz.add('icon-pause'));
    this.progressTaskController = controller;
  }

  setProgress(n: number): void {
    this.progressLabel.text(`Progress ${int(n * 100)}%`);
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

  private createView(): Widget {
    const array = f32array(this.buffer, this.bufferSize, this.bufferSize, this.mapper);
    const raster = rasterWorkplaneRenderer(() => array);
    this.workplane = new Workplane(this._ui, raster, this.createGridRenderer());
    this.workplane.centerRect(this.bufferSize, this.bufferSize);
    this.actions.push(this.actionsContext.bind('reset-workplane', async () => this.workplane.centerRect(this.bufferSize, this.bufferSize)));
    this.imagesTable = table<[number, string, Image]>(this._ui, [], [column('Name', async r => r[1], (b, v) => b.block().text(v))]);
    this.imagesTable.addSelectionHandler(([id, name, _]) => this.selectImage(id, name));
    this.sidebarRight = this._ui.block('stack-container');

    return this._ui.row(['padded-5', 'gap-5'])
      .widget(this.imagesTable, '200px')
      .widget(this.workplane, '1')
      .resizable(this.sidebarRight, 300, 100, 500)
  }

  private createGridRenderer(): WorkplaneRendererBuilder {
    return (canvas, ctx) => {
      const renderer = () => renderGrid(canvas, ctx, this.gridSize.get(), this.bufferSize);
      this.gridSize.subscribe(_ => renderer());
      return renderer;
    }
  }

  private gridControl() {
    const sizes = ["0", "1", "2", "3", "4", "5", "6", "12"];
    const sizesToggler = cyclicToggler(sizes, this.gridSizeName.get());
    this.gridSizeName.subscribe(value => sizesToggler.set(value));
    const box = listBuilder(this._ui, this.gridSizeName)
      .items(sizes)
      .labelPrefix('Grid: ')
      .labelMod(style.width('55px'))
      .build();
    this.actions.push(this.actionsContext.bindSync('grid', blockActions.click(box)));
    this.actions.push(this.actionsContext.bindSync('grid-inc', () => this.gridSizeName.set(sizesToggler.toggleNext())));
    this.actions.push(this.actionsContext.bindSync('grid-dec', () => this.gridSizeName.set(sizesToggler.togglePrev())));
    return box;
  }


  public stack(): VecStack { return this._stack }
  public currentImageName(): string { return this._currentImageName }
  public imageProvider(): (name: string) => Image { return s => this.imageMap.get(s) }

  public images(img: Image): Supplier<Iterable<string>> {
    return () => iter(this.imageMap.entries())
      .filter(([_, i]) => !i.dependsOn(img))
      .map(([name, _]) => name)
  }

  public stop() { this.window.destroy() }
  public show() { this._ui.showWindow(this.window); this.redraw() }
}