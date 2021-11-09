import h from "stage0";
import { vec3, Vec3Array } from "../../libs_js/glmatrix";
import { CallbackChannel, CallbackChannelImpl, CallbackHandlerImpl, Handle, handle, Source, transformed, tuple, value } from "../../utils/callbacks";
import { filter, getOrCreate, map } from "../../utils/collections";
import { create, lifecycle, Module, plugin } from "../../utils/injector";
import { Range, Vec3Interpolator } from "../../utils/interpolator";
import { clamp, fract, HashMap, int, len2d, octaves2d, perlin2d, smothstep, Vec2Eq, Vec2Hash } from "../../utils/mathutils";
import { array, Raster, rect, resize } from "../../utils/pixelprovider";
import { listProp, menuButton, NavItem1, navTree, NavTreeModel, Oracle, properties, Property, rangeProp } from "../../utils/ui/renderers";
import { addDragController, replaceContent } from "../../utils/ui/ui";
import { BasicValue, floatValue, intValue, numberRangeValidator } from "../../utils/value";
import { VecStack } from "../../utils/vecstack";
import { Scheduler, SCHEDULER, TaskHandle } from "../apis/app";
import { BUS, busDisconnector } from "../apis/handler";
import { Ui, UI, Window } from "../apis/ui";
import { namedMessageHandler } from "../edit/messages";
import { ambientOcclusion, circularArray, decircular, displacedPointGrid, pointGrid, sdf3d, softShadow } from "../modules/sdf/sdf";

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

type Renderer = (stack: VecStack, pos: number) => number;
type Value<T> = Source<T> & CallbackChannel<[]>;
type Image = { renderer: Value<Renderer>, settings: Value<Property[]> }
type Postprocessor = (stack: VecStack, pos: number) => number;

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

function profile(p: (name: string) => Image, oracle: Oracle<string>): Image {
  const src = transformedParam('Profile', p, oracle);
  const y = param('Y', 0.5);

  const props = [src.prop, y.prop];

  const renderer = value(VOID_RENDERER);
  const settings = value(props);

  handle(null, (p, src) => {
    if (src == null) {
      renderer.set(VOID_RENDERER);
      settings.set(props);
      return
    }

    handle(p, (p, src, y) => {
      renderer.set((stack: VecStack, pos: number) => {
        const x = stack.x(pos);
        const value = stack.callScalar(src, stack.push(x, y, 0, 0));
        const py = stack.y(pos);
        const v = clamp(smothstep(value - (1 - py), 0, 0.01) * 100, 0, 1);
        return stack.push(v, 0, 0, 1);
      });
    }, src.renderer, y.value);

    handle(p, (p, s) => {
      settings.set([...props, ...s]);
    }, src.settings);

  }, src.value);

  return { renderer, settings }
}

function perlin(): Image {
  const scale = param('Scale', 1);
  const octaves = param('Octaves', 1, intValue(1, numberRangeValidator(1, 8)));

  const renderer = transformed(tuple(scale.value, octaves.value), ([s, o]) => {
    const noise = octaves2d(perlin2d, o);
    return (stack: VecStack, pos: number) => {
      const x = stack.x(pos) * s;
      const y = stack.y(pos) * s;
      const result = noise(x, y);
      return stack.push(result, 0, 0, 1);
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
    const l = stack.distance(stack.push(stack.x(pos), stack.y(pos), 0, 0), stack.push(0.5, 0.5, 0, 0));
    const v = clamp(radius - l, 0, radius);
    const p = 1 + pow;
    const pp = p >= 1 ? p : (1 / (2 - p))
    const k = Math.pow(v / radius, pp) * radius;
    return stack.push(k, 0, 0, 1);
  });
  return { renderer, settings: value([radiusProp, powProp]) }
}


function profiles(): Image {
  const profiles = {
    'Identity': (x: number) => x,
    'Sin': (x: number) => Math.sin(x),
    'Cos': (x: number) => Math.cos(x),
    'Step': (x: number) => x <= 0 ? 1 : x <= 0.5 ? 0.5 : 0,
    'Circle': (x: number) => Math.abs(x) > 1 ? 0 : Math.sqrt(1 - x * x),
    'Anti Circle': (x: number) => Math.abs(x) > 1 ? 0 : 1 - Math.sqrt(1 - x * x),
  }
  const profileKeys = Object.keys(profiles);
  const profile = transformedParam('Profile', s => profiles[s], _ => profileKeys, 'Identity');
  const xoff = param('X Offset', 0);
  const yoff = param('Y Offset', 0);
  const xscale = param('X Scale', 1);
  const yscale = param('Y Scale', 1);

  const renderer = transformed(tuple(profile.value, xoff.value, yoff.value, xscale.value, yscale.value), ([profile, xoff, yoff, xscale, yscale]) => (stack: VecStack, pos: number) => {
    const x = stack.x(stack.add(stack.scale(pos, xscale), stack.push(xoff, 0, 0, 0)));
    return stack.push(yoff + profile(x) * yscale, 0, 0, 1);
  });

  return { renderer, settings: value([profile.prop, xoff.prop, yoff.prop, xscale.prop, yscale.prop]) };
}

function pointDistance(): Image {
  return { renderer: value((stack: VecStack, pos: number) => stack.push(stack.distance(stack.push(0.5, 0.5, 0, 0), pos), 0, 0, 1)), settings: value([]) };
}

function sdf(p: (name: string) => Image, oracle: Oracle<string>): Image {
  const distance = transformedParam('SDF', p, oracle);
  const profile = transformedParam('Profile', p, oracle);

  const props = [distance.prop, profile.prop];

  const renderer = value(VOID_RENDERER);
  const settings = value(props);

  handle(null, (p, distance, profile) => {
    if (profile == null || distance == null) {
      renderer.set(VOID_RENDERER);
      settings.set(props);
      return
    }

    handle(p, (p, distance, profile) => {
      renderer.set((stack: VecStack, pos: number) => {
        const dist = stack.x(stack.call(distance, pos));
        const v = stack.x(stack.call(profile, stack.push(dist, 0, 0, 0)));
        return stack.push(v, 0, 0, 1);
      });
    }, distance.renderer, profile.renderer);

    handle(p, (p, d, pr) => {
      settings.set([...props, ...d, ...pr]);
    }, distance.settings, profile.settings);

  }, distance.value, profile.value);

  return { renderer, settings }
}

function render(stack: VecStack, p: (name: string) => Image, oracle: Oracle<string>): Image {
  const hmap = transformedParam('Height Map', p, oracle);
  const lightX = param('Light X', 0.7);
  const lightY = param('Light Y', 0);
  const lightZ = param('Light Z', -0.5);
  const props = [hmap.prop, lightX.prop, lightY.prop, lightZ.prop];

  const toLight = stack.pushGlobal(0, 0, 0, 0);

  const renderer = value(VOID_RENDERER);
  const settings = value(props);

  handle(null, (p, hmap) => {
    if (hmap == null) {
      renderer.set(VOID_RENDERER);
      settings.set(props);
      return
    }

    handle(p, (p, hmap, lightX, lightY, lightZ) => {
      stack.begin();
      stack.copy(toLight, stack.normalize(stack.sub(stack.push(lightX, lightY, lightZ, 0), stack.push(0.5, 0.5, 0, 0))));
      stack.end();
      const shape = (stack: VecStack, pos: number) => {
        const x = stack.x(pos);
        const y = stack.y(pos);
        const z = stack.z(pos);
        const v = stack.x(stack.call(hmap, stack.push(x, y, 0, 0)));
        return stack.pushScalar(-v - z);
      };
      const r = (stack: VecStack, pos: number, normal: number) => {
        const fromEye = stack.sub(pos, stack.push(0.5, 0.5, -1, 0));
        const reflect = stack.normalize(stack.reflect(fromEye, normal));
        const diffuse = stack.dot(normal, toLight);
        const specular = Math.pow(Math.max(stack.dot(toLight, reflect), 0), 20);
        const ambient = stack.callScalar(ambientOcclusion, pos, normal, shape);
        const shadow = stack.callScalar(softShadow, pos, toLight, shape);
        return stack.push(clamp(0.1 + shadow * (ambient * diffuse + specular), 0, 1), 0, 0, 1);
      };
      const plane = sdf3d(shape, r);
      renderer.set((stack: VecStack, pos: number) => stack.call(plane, pos));
    }, hmap.renderer, lightX.value, lightY.value, lightZ.value);

    handle(p, (p, s) => {
      settings.set([...props, ...s]);
    }, hmap.settings);

  }, hmap.value);

  return { renderer, settings };
}

function box(p: (name: string) => Image, oracle: Oracle<string>): Image {
  const w = param('Width', 0.5);
  const h = param('Height', 0.5);
  const r = param('Radius', 0.1);
  const max = param('Max', 1);
  const profile = transformedParam('Profile', p, oracle);

  const props = [w.prop, h.prop, r.prop, max.prop, profile.prop];

  const renderer = value(VOID_RENDERER);
  const settings = value(props);

  handle(null, (p, profile) => {
    if (profile == null) {
      renderer.set(VOID_RENDERER);
      settings.set(props);
      return
    }

    handle(p, (p, profile, w, h, r, max) => {
      renderer.set((stack: VecStack, pos: number) => {
        const dc = stack.apply(stack.sub(pos, stack.half), Math.abs);
        const d = stack.sub(dc, stack.push(w / 2, h / 2, 0, 0));
        const dist = Math.max(stack.x(d), stack.y(d));
        const cdist = clamp(dist, 0, r) / r;
        return stack.push(stack.x(stack.call(profile, stack.push(cdist, 0, 0, 0))) * max, 0, 0, 1);
      });
    }, profile.renderer, w.value, h.value, r.value, max.value);

    handle(p, (p, s) => {
      settings.set([...props, ...s]);
    }, profile.settings);

  }, profile.value);

  return { renderer, settings }
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
        const value = stack.callScalar(src, pos);
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

function voronoi(stack: VecStack, p: (name: string) => Image, oracle: Oracle<string>): Image {
  const src = transformedParam('Source', p, oracle);
  const scale = param('Scale', 4);
  const props = [src.prop, scale.prop];

  const core = [...map(CORE, c => stack.pushGlobal(c[0], c[1], 0, 0))];

  const renderer = value(VOID_RENDERER);
  const settings = value(props);

  handle(null, (p, src) => {
    if (src == null) {
      renderer.set(VOID_RENDERER);
      settings.set(props);
      return
    }

    handle(p, (p, src, scale) => {
      renderer.set((stack: VecStack, pos: number) => {
        const s1 = 1 / scale;
        const n = stack.scale(pos, scale);
        const c = stack.apply(n, Math.floor);
        const f = stack.apply(n, fract);

        let mind = 8;
        let mini = 0;
        const minr = stack.allocate();

        for (let i = 0; i < 9; i++) {
          stack.begin();
          const xy = core[i];
          const v = stack.call(src, stack.scale(stack.add(c, xy), s1));
          const r = stack.add(xy, stack.sub(v, f));
          const d = stack.sqrlength(r);
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
          const v = stack.call(src, stack.scale(stack.add(c, xy), s1));
          const r = stack.add(xy, stack.sub(v, f));
          const dr = stack.sub(r, minr);
          if (stack.eqz(dr)) { stack.end(); continue }
          const sr = stack.scale(stack.add(r, minr), 0.5);
          const d = Math.abs(stack.dot(sr, dr));
          mind = Math.min(d, mind);
          stack.end();
        }

        return stack.push(mind, 0, 0, 0);
      });
    }, src.renderer, scale.value);

    handle(p, (p, s) => {
      settings.set([...props, ...s]);
    }, src.settings);

  }, src.value);

  return { renderer, settings }
}

function hash(stack: VecStack, x: number): number {
  return stack.push((0.5 + Math.sin(x * Math.PI) * 0.5), (0.5 + Math.cos(x * Math.PI) * 0.5), 0, 0);
}

function grad(f: (stack: VecStack, pos: number) => number, stack: VecStack, pos: number, d: number) {
  const dx = stack.push(d, 0, 0, 0);
  const dy = stack.push(0, d, 0, 0);
  const d1 = stack.x(f(stack, stack.add(pos, dx)));
  const d2 = stack.x(f(stack, stack.sub(pos, dx)));
  const d3 = stack.x(f(stack, stack.add(pos, dy)));
  const d4 = stack.x(f(stack, stack.sub(pos, dy)));
  return stack.normalize(stack.push(d1 - d2, d3 - d4, d, 0));
}

function gradient(p: (name: string) => Image, oracle: Oracle<string>): Image {
  const src = transformedParam('Source', p, oracle);
  const scale = param('Scale', 1);
  const sample = param('Samle Scale', 0.001);
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
        return stack.call(src, stack.add(stack.scale(stack.call(displace, pos), scale), pos));
      });
    }, src.renderer, displace.renderer, scale.value);

    handle(p, (p, s, d) => {
      settings.set([...props, ...s, ...d]);
    }, src.settings, displace.settings);

  }, src.value, displace.value);

  return { renderer, settings };
}

function blend(p: (name: string) => Image, oracle: Oracle<string>): Image {
  const funcs = {
    "Blend": (stack: VecStack, lh: number, rh: number, t: number) => stack.lerp(lh, rh, t),
    "Max": (stack: VecStack, lh: number, rh: number, t: number) => stack.apply2(lh, rh, Math.max),
    "Min": (stack: VecStack, lh: number, rh: number, t: number) => stack.apply2(lh, rh, Math.min),
    "Add": (stack: VecStack, lh: number, rh: number, t: number) => stack.add(lh, rh),
    "Multiply": (stack: VecStack, lh: number, rh: number, t: number) => stack.mul(lh, rh),
  }

  const src1 = transformedParam('Source 1', p, oracle);
  const src2 = transformedParam('Source 2', p, oracle);
  const func = transformedParam('Function', f => funcs[f], _ => Object.keys(funcs), 'Blend');
  const t = param('Delta', 0.5);
  const props = [src1.prop, src2.prop, func.prop, t.prop];

  const renderer = value(VOID_RENDERER);
  const settings = value(props);

  handle(null, (p, src1, src2) => {
    if (src1 == null || src2 == null) {
      renderer.set(VOID_RENDERER);
      settings.set(props);
      return
    }

    handle(p, (p, src1, src2, func, t) => {
      renderer.set((stack: VecStack, pos: number) => {
        const s1 = stack.call(src1, pos);
        const s2 = stack.call(src2, pos);
        return func(stack, s1, s2, t);
      });
    }, src1.renderer, src2.renderer, func.value, t.value);

    handle(p, (p, s1, s2) => {
      settings.set([...props, ...s1, ...s2]);
    }, src1.settings, src2.settings);

  }, src1.value, src2.value);

  return { renderer, settings };
}

function apply(stack: VecStack, p: (name: string) => Image, oracle: Oracle<string>): Image {
  const funcs = {
    "Fract": fract,
    "Sin": Math.sin,
    "Ident": (x: number) => x,
    "Sin1": (x: number) => (1 - smothstep(x, 0, Math.PI * 2)) * Math.sin(x),
    "Clamp": (x: number) => clamp(x, 0, 1),
    "Max 0.5": (x: number) => Math.max(x, 0.5)
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
        return stack.call(displacedPointGrid(s, stack.zero, src), stack.push(stack.x(pos), stack.y(pos), 0, 0));
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