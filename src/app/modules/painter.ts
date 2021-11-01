import h from "stage0";
import { vec3, Vec3Array } from "../../libs_js/glmatrix";
import { CallbackChannel, CallbackChannelImpl, CallbackChannelStub, CallbackHandler, CallbackHandlerImpl, Handle, handle, Source, value, tuple, transformed, reference } from "../../utils/callbacks";
import { filter, map, range } from "../../utils/collections";
import { create, lifecycle, Module, plugin } from "../../utils/injector";
import { Range, Vec3Interpolator } from "../../utils/interpolator";
import { KDTree } from "../../utils/kdtree";
import { clamp, fract, int, len2d, octaves2d, perlin2d, smothstep } from "../../utils/mathutils";
import { array, Raster, rect, resize } from "../../utils/pixelprovider";
import { listProp, menuButton, NavItem1, navTree, NavTreeModel, Oracle, properties, Property, rangeProp, ValueHandleImpl } from "../../utils/ui/renderers";
import { addDragController, replaceContent } from "../../utils/ui/ui";
import { BasicValue, floatValue, intNumberValidator, intValue, numberRangeValidator } from "../../utils/value";
import { VecStack } from "../../utils/vecstack";
import { Scheduler, SCHEDULER, TaskHandle } from "../apis/app";
import { BUS, busDisconnector } from "../apis/handler";
import { Ui, UI, Window } from "../apis/ui";
import { namedMessageHandler } from "../edit/messages";
import { circularArray, decircular, displacedPointGrid, lineSegment, pointGrid, union } from "../modules/sdf/sdf";

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

type Renderer = (stack: VecStack, pos: number) => number;
type Value<T> = Source<T> & CallbackChannel<[]>;
type Image = { renderer: Value<Renderer>, settings: Value<Property[]> }
type Postprocessor = (stack: VecStack, pos: number) => number;

const NORMAL = (stack: VecStack, res: number) => {
  const r = 255 * stack.x(res);
  const g = 255 * stack.y(res);
  const b = 255 * stack.z(res);
  const a = 255 * stack.w(res);
  return r | (g << 8) | (b << 16) | (a << 24);
}

const GRAY_R = (stack: VecStack, res: number) => {
  const r = 255 * clamp(stack.x(res), 0, 1);
  return r | (r << 8) | (r << 16) | (255 << 24);
}

const BLUE_RED = new Range([0, 0, 255], [255, 0, 0], Vec3Interpolator);
const PLUS_MINUS_ONE_R = (stack: VecStack, res: number) => {
  const i = (stack.x(res) + 1) * 0.5;
  const [r, g, b] = BLUE_RED.get(i);
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

type Parameter<T> = { value: Value<T>, prop: Property };
function param(name: string, def: number, valueParams: BasicValue<number> = floatValue(def, _ => true)): Parameter<number> {
  const val = value(def);
  return {
    value: val,
    prop: rangeProp(name, val, valueParams)
  }
}

function transformedParam<T>(name: string, trans: (name: string) => T, oracle: Oracle<string>, def = ''): Parameter<T> {
  const valueName = value(def);
  const val = transformed(valueName, trans);
  return {
    value: val,
    prop: listProp(name, oracle, valueName)
  }
}


function perlin(): Image {
  const scale = param('Scale', 1);
  const octaves = param('Octaves', 1, intValue(1, numberRangeValidator(1, 4)));

  const renderer = transformed(tuple(scale.value, octaves.value), ([s, o]) => {
    const noise = octaves2d(perlin2d, o);
    return (stack: VecStack, pos: number) => {
      const nx = noise(stack.x(pos) * s, stack.y(pos) * s);
      const ny = noise(stack.y(pos) * s, stack.x(pos) * s);
      return stack.push(nx, ny, 0, 1);
    }
  });
  return { renderer, settings: value([scale.prop, octaves.prop]) }
}

function circle(): Image {
  const radius = value(0.5);
  const pow = value(0);
  const radiusProp = rangeProp('Radius', radius, floatValue(0.5, _ => true));
  const powProp = rangeProp('Power', pow, floatValue(0, _ => true));

  const renderer = transformed(tuple(radius, pow), ([radius, pow]) => (stack: VecStack, pos: number) => {
    const l = stack.distance(pos, stack.push(0.5, 0.5, 0, 0));
    const v = clamp(radius - l, 0, radius);
    const p = 1 + pow;
    const pp = p >= 1 ? p : (1 / (2 - p))
    const k = Math.pow(v / radius, pp) * radius;
    return stack.push(k, 0, 0, 1);
  });
  return { renderer, settings: value([radiusProp, powProp]) }
}

function box(): Image {
  const w = param('Width', 0.5);
  const h = param('Height', 0.5);
  const r = param('Radius', 0.1);
  const pow = param('Power', 0);

  const renderer = transformed(tuple(w.value, h.value, r.value, pow.value), ([w, h, r, pow]) => (stack: VecStack, pos: number) => {
    const dc = stack.apply(stack.sub(pos, stack.half), Math.abs);
    const d = stack.sub(dc, stack.push(w / 2, h / 2, 0, 0));
    const dist = Math.max(stack.x(d), stack.y(d));
    const cdist = 1 - clamp(dist, 0, r) / r;
    const p = 1 + pow;
    const pp = p >= 1 ? p : (1 / (2 - p))
    return stack.push(Math.pow(cdist, pp), 0, 0, 1);
  });

  return { renderer, settings: value([w.prop, h.prop, r.prop, pow.prop]) };
}

const VOID_RENDERER = (stack: VecStack, pos: number) => stack.push(0, 0, 0, 0);

function select(p: (name: string) => Image, oracle: Oracle<string>): Image {
  const src = transformedParam('Source', p, oracle);
  const from = param('From', 0);
  const to = param('To', 0);
  const smoth = param('Smoth', 0);

  const props = [src.prop, from.prop, to.prop, smoth.prop];

  const renderer = value(VOID_RENDERER);
  const settings = value(props);

  handle(null, (p, src) => {
    if (src == null) {
      renderer.set(VOID_RENDERER);
      settings.set(props);
      return
    }

    handle(p, (p, src, from, to, smoth) => {
      renderer.set((stack: VecStack, pos: number) => {
        const value = stack.x(stack.call(src, pos));
        const l = smothstep(value, from - smoth, from);
        const r = 1 - smothstep(value, to, to + smoth);
        return stack.push(Math.min(l, r), 0, 0, 1);
      });
    }, src.renderer, from.value, to.value, smoth.value);

    handle(p, (p, s) => {
      settings.set([...props, ...s]);
    }, src.settings);

  }, src.value);

  return { renderer, settings }
}

const CORE: [number, number][] = [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]

function voronoi(stack: VecStack, p: (name: string) => Image2d, oracle: Oracle<string>): Image2d {
  const cbs = new Callbacks<Image2d>();
  const noise = new ValueHandleIml('');
  const scale = new ValueHandleIml(4);
  noise.addListener(() => cbs.notify(null));
  scale.addListener(() => cbs.notify(null));
  const settings = properties([
    listProp('Noise', oracle, noise),
    rangeProp('Scale', 1, 100, scale)
  ]);
  const core = [...map(CORE, c => stack.pushGlobal(c[0], c[1], 0, 0))];
  const pixel = (stack: VecStack, pos: number) => {
    const noiseImage = p(noise.get());
    const s = 1 / scale.get();
    const n = stack.scale(pos, 1 / s);
    const c = stack.apply(n, Math.floor);
    const f = stack.apply(n, fract);
    const img = (stack: VecStack, pos: number) => stack.call(noiseImage.pixel, stack.scale(stack.add(c, pos), s));

    let mind = 8;
    let mini = 0;
    const minr = stack.allocate();

    for (let i = 0; i < 9; i++) {
      stack.begin();
      const xy = core[i];
      const v = hash(stack, img(stack, xy));
      const r = stack.add(xy, stack.sub(v, f));
      const d = stack.dot(r, r);
      if (d < mind) {
        mind = d;
        mini = i;
        stack.copy(minr, r);
      }
      stack.end();
    }

    const minxy = core[mini];
    mind = 8;
    for (let i = 0; i < 9; i++) {
      stack.begin();
      const xy = stack.add(minxy, core[i]);
      const v = hash(stack, img(stack, xy));
      const r = stack.add(xy, stack.sub(v, f));
      const dr = stack.sub(r, minr);
      if (stack.eqz(dr)) { stack.end(); continue }
      const sr = stack.scale(stack.add(r, minr), 0.5);
      const d = Math.abs(stack.dot(sr, dr));
      mind = Math.min(d, mind);
      stack.end();
    }

    return stack.push(mind, 0, 0, 0);
  }
  const addListener = (cb: (v: Image2d) => void) => cbs.add(cb);
  const removeListener = (id: number) => cbs.remove(id);
  return { pixel, settings, addListener, removeListener, type: Type.VALUE }
}

function hash(stack: VecStack, x: number): number {
  return stack.push((0.5 + Math.sin(x * Math.PI) * 0.5), (0.5 + Math.cos(x * Math.PI) * 0.5), 0, 0);
}

function grad(f: (stack: VecStack, pos: number) => number, stack: VecStack, pos: number, d: number) {
  const d1 = stack.x(f(stack, stack.add(pos, stack.push(-d, 0, 0, 0))));
  const d2 = stack.x(f(stack, stack.add(pos, stack.push(d, 0, 0, 0))));
  const d3 = stack.x(f(stack, stack.add(pos, stack.push(0, -d, 0, 0))));
  const d4 = stack.x(f(stack, stack.add(pos, stack.push(0, d, 0, 0))));
  return stack.normalize(stack.push(d1 - d2, d3 - d4, d, 0));
}

function gradient(p: (name: string) => Image, oracle: Oracle<string>): Image {
  const src = transformedParam('Source', p, oracle);
  const scale = param('Scale', 1);
  const sample = param('Samle Scale', 0.0001);
  const props = [src.prop, scale.prop, sample.prop];

  const renderer = value(VOID_RENDERER);
  const settings = value(props);

  handle(null, (p, src) => {
    if (src == null) {
      renderer.set(VOID_RENDERER);
      settings.set(props);
      return
    }

    handle(p, (p, src, scale, sample) => {
      renderer.set((stack: VecStack, pos: number) => {
        return stack.scale(grad(src, stack, pos, sample), scale);
      });
    }, src.renderer, scale.value, sample.value);

    handle(p, (p, s) => {
      settings.set([...props, ...s]);
    }, src.settings);

  }, src.value);

  return { renderer, settings };

}

function displace(p: (name: string) => Image, oracle: Oracle<string>): Image {
  const src = transformedParam('Source', p, oracle);
  const displace = transformedParam('Displace', p, oracle);
  const scale = param('Scale', 1);
  const props = [src.prop, displace.prop, scale.prop];

  const renderer = value(VOID_RENDERER);
  const settings = value(props);

  handle(null, (p, src, displace) => {
    if (src == null || displace == null) {
      renderer.set(VOID_RENDERER);
      settings.set(props);
      return
    }

    handle(p, (p, src, displace, scale) => {
      renderer.set((stack: VecStack, pos: number) => {
        return stack.call(src, stack.scale(stack.add(stack.call(displace, pos), pos), scale));
      });
    }, src.renderer, displace.renderer, scale.value);

    handle(p, (p, s, d) => {
      settings.set([...props, ...s, ...d]);
    }, src.settings, displace.settings);

  }, src.value, displace.value);

  return { renderer, settings };
}

function apply(stack: VecStack, p: (name: string) => Image, oracle: Oracle<string>): Image {
  const funcs = {
    "Fract": fract,
    "Sin": Math.sin,
    "Ident": (x: number) => x,
    "Sin1": (x: number) => (1 - smothstep(x, 0, Math.PI * 2)) * Math.sin(x),
  }

  const src = transformedParam('Source', p, oracle);
  const func = transformedParam('Function', f => funcs[f], _ => Object.keys(funcs), 'Ident');
  const scale = param('Scale', 1);
  const offset = param('Offset', 0);

  const off = stack.pushGlobal(0, 0, 0, 0);
  const s = stack.pushGlobal(1, 1, 1, 1);

  const props = [src.prop, func.prop, scale.prop, offset.prop];

  const renderer = value(VOID_RENDERER);
  const settings = value(props);

  handle(null, (p, src) => {
    if (src == null) {
      renderer.set(VOID_RENDERER);
      settings.set(props);
      return
    }

    handle(p, (p, src, func, scale, offset) => {
      stack.spread(off, offset);
      stack.spread(s, scale);
      renderer.set((stack: VecStack, pos: number) => {
        return stack.apply(stack.add(stack.mul(stack.call(src, pos), s), off), func);
      });
    }, src.renderer, func.value, scale.value, offset.value);

    handle(p, (p, s) => {
      settings.set([...props, ...s]);
    }, src.settings);

  }, src.value);

  return { renderer, settings };
}

function repeat(p: (name: string) => Image, oracle: Oracle<string>): Image {
  const src = transformedParam('Source', p, oracle);
  const scalex = param('Scale X', 3);
  const scaley = param('Scale Y', 3);
  const props = [src.prop, scalex.prop, scaley.prop];

  const renderer = value(VOID_RENDERER);
  const settings = value(props);

  handle(null, (p, src) => {
    if (src == null) {
      renderer.set(VOID_RENDERER);
      settings.set(props);
      return
    }

    handle(p, (p, src, scalex, scaley) => {
      renderer.set((stack: VecStack, pos: number) => {
        const s = stack.push(scalex, scaley, 0, 0);
        return stack.call(src, stack.apply(stack.mul(pos, s), fract));
      });
    }, src.renderer, scalex.value, scaley.value);

    handle(p, (p, s) => {
      settings.set([...props, ...s]);
    }, src.settings);

  }, src.value);

  return { renderer, settings };
}

function circular(p: (name: string) => Image, oracle: Oracle<string>): Image {
  const src = transformedParam('Source', p, oracle);
  const count = param('Count', 1);

  const props = [src.prop, count.prop];

  const renderer = value(VOID_RENDERER);
  const settings = value(props);

  handle(null, (p, src) => {
    if (src == null) {
      renderer.set(VOID_RENDERER);
      settings.set(props);
      return
    }

    handle(p, (p, src, count) => {
      renderer.set((stack: VecStack, pos: number) => {
        return stack.call(circularArray(count, src), pos);
      });
    }, src.renderer, count.value);

    handle(p, (p, s) => {
      settings.set([...props, ...s]);
    }, src.settings);

  }, src.value);

  return { renderer, settings };
}

function decircular1(stack: VecStack, p: (name: string) => Image2d, oracle: Oracle<string>): Image2d {
  const cbs = new Callbacks<Image2d>();
  const src = new ValueHandleIml('');
  const scale = new ValueHandleIml(1);
  const off = new ValueHandleIml(0);
  const params = stack.pushGlobal(1, 0, 0, 0);
  src.addListener(() => cbs.notify(null));
  scale.addListener(v => { stack.setx(params, v); cbs.notify(null) });
  off.addListener(v => { stack.sety(params, v); cbs.notify(null) });
  const settings = properties([
    listProp('Source', oracle, src),
    rangeProp('Scale', -100, 100, scale),
    rangeProp('Offset', -100, 100, off),
  ]);

  const pixel = (stack: VecStack, pos: number) => {
    const source = p(src.get());
    return stack.call(decircular(params, source.pixel), pos);
  }

  const addListener = (cb: (v: Image2d) => void) => cbs.add(cb);
  const removeListener = (id: number) => cbs.remove(id);
  return { pixel, settings, addListener, removeListener, type: Type.VALUE }
}

function transform(p: (name: string) => Image, oracle: Oracle<string>): Image {
  const src = transformedParam('Source', p, oracle);
  const scale = param('Scale', 1);
  const offx = param('X Offset', 0);
  const offy = param('Y Offset', 0);
  const props = [src.prop, scale.prop, offx.prop, offy.prop];

  const renderer = value(VOID_RENDERER);
  const settings = value(props);

  handle(null, (p, src) => {
    if (src == null) {
      renderer.set(VOID_RENDERER);
      settings.set(props);
      return
    }

    handle(p, (p, src, scale, offx, offy) => {
      renderer.set((stack: VecStack, pos: number) => {
        const half = stack.push(0.5, 0.5, 0, 0);
        const off = stack.push(offx, offy, 0, 0);
        const np = stack.add(stack.add(stack.scale(stack.sub(pos, half), scale < 0 ? scale : (1 / -scale)), half), off);
        return stack.call(src, np);
      });
    }, src.renderer, scale.value, offx.value, offy.value);

    handle(p, (p, s) => {
      settings.set([...props, ...s]);
    }, src.settings);

  }, src.value);

  return { renderer, settings };
}

function grid(stack: VecStack): Image {
  const offx = param('X Offset', 0)
  const offy = param('Y Offset', 0);
  const scale = param('Scale', 1);

  const off = stack.pushGlobal(0, 0, 0, 0);
  const s = stack.pushGlobal(1, 1, 1, 1);

  const props = [offx.prop, offy.prop, scale.prop];

  const renderer = transformed(tuple(offx.value, offy.value, scale.value), ([offx, offy, scale]) => {
    stack.set(off, offx, offy, 0, 0);
    stack.spread(s, scale);
    const f = pointGrid(s, off);
    return (stack: VecStack, pos: number) => stack.call(f, pos);
  });

  return { renderer, settings: value(props) };
}

function displacedGrid(stack: VecStack, p: (name: string) => Image, oracle: Oracle<string>): Image {
  const src = transformedParam('Source', p, oracle);
  const scale = param('Scale', 1);
  const props = [src.prop, scale.prop];

  const s = stack.pushGlobal(1, 1, 1, 1);

  const renderer = value(VOID_RENDERER);
  const settings = value(props);

  handle(null, (p, src) => {
    if (src == null) {
      renderer.set(VOID_RENDERER);
      settings.set(props);
      return
    }

    handle(p, (p, src, scale) => {
      stack.spread(s, scale);
      renderer.set((stack: VecStack, pos: number) => {
        return stack.call(displacedPointGrid(s, stack.zero, src), pos);
      });
    }, src.renderer, scale.value);

    handle(p, (p, s) => {
      settings.set([...props, ...s]);
    }, src.settings);

  }, src.value);

  return { renderer, settings };
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
  private currentImage = value(<Image>null);
  private settingsHandle = new CallbackHandlerImpl(() => replaceContent(this.sidebarRight, properties(this.currentImage.get().settings.get())));
  private postrocessor = value(NORMAL);

  constructor(private ui: Ui, private scheduler: Scheduler) {
    this.recreateBuffer();
    this.renderer = new Image2dRenderer(scheduler, this.stack, this.buffer, this.bufferSize, this.postrocessor);
    this.renderer.add(() => this.redraw());
    this.currentImage.add(() => this.renderer.set(this.currentImage.get().renderer))

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
        .widget(this.createPPMenu())
        .endGroup())
      .build();

    // const kdtree = new KDTree([...map(range(0, 100), _ => <[number, number]>[Math.random(), Math.random()])]);
    // const line1 = lineSegment(this.stack.pushGlobal(0.5, 0.0, 0, 0), this.stack.pushGlobal(0.5, 1.0, 0, 0));
    // const line2 = lineSegment(this.stack.pushGlobal(0.0, 0.6, 0, 0), this.stack.pushGlobal(1.0, 0.6, 0, 0));
    // const lines = union(line1, line2);
    // const grid = pointGrid(this.stack.pushGlobal(1, 1, 1, 1), this.stack.pushGlobal(0.5, 0, 0, 0))
    // const _hash = (stack: VecStack, p: number) => hash(stack, perlin2d(stack.x(p) * 13.123, stack.y(p) * 13.123))
    // const points = displacedPointGrid(this.stack.pushGlobal(10, 10, 1, 1), this.stack.pushGlobal(0, 0, 0, 0), _hash);

    this.addImage('Circle', circle());
    this.addImage('Box', box());
    this.addImage('Perlin', perlin());
    this.addImage('Select', select(this.imageProvider(), this.shapeOracle()));
    this.addImage('Displace', displace(this.imageProvider(), this.shapeOracle()));
    this.addImage('Repeat', repeat(this.imageProvider(), this.shapeOracle()));
    // this.addImage('Voronoi', voronoi(this.stack, this.imageProvider(), this.shapeOracle()));
    // this.addImage('Distance', distance2d((stack, p) => stack.push(kdtree.distance(stack.x(p), stack.y(p)), 0, 0, 0)));
    // this.addImage('Line', distance2d(circular));
    this.addImage('Circular', circular(this.imageProvider(), this.shapeOracle()));
    this.addImage('Transform', transform(this.imageProvider(), this.shapeOracle()));
    this.addImage('Grid', grid(this.stack));
    this.addImage('Displaced Grid', displacedGrid(this.stack, this.imageProvider(), this.shapeOracle()));
    this.addImage('Apply', apply(this.stack, this.imageProvider(), this.shapeOracle()));
    // this.addImage('Decircular', decircular1(this.stack, this.imageProvider(), this.shapeOracle()));
    this.addImage('Gradient', gradient(this.imageProvider(), this.shapeOracle()));
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