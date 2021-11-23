import { perlin_simd_octaves } from "wasm_rust";
import { CallbackChannel, handle, Source, transformed, tuple, value } from "../../../utils/callbacks";
import { map } from "../../../utils/collections";
import { clamp, fract, octaves2d, perlin2d, smothstep, Vec2Hash } from "../../../utils/mathutils";
import { listProp, Oracle, Property, rangeProp } from "../../../utils/ui/renderers";
import { BasicValue, floatValue, intValue, numberRangeValidator } from "../../../utils/value";
import { VecStack } from "../../../utils/vecstack";
import { ambientOcclusion, circularArray, displacedPointGrid, pointGrid, sdf3d, softShadow } from "../sdf/sdf";

export type Renderer = (stack: VecStack, pos: number) => number;
export type Value<T> = Source<T> & CallbackChannel<[]>;
export type Image = { renderer: Value<Renderer>, settings: Value<Property[]> }
export type Postprocessor = (stack: VecStack, pos: number) => number;

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

export function profile(p: (name: string) => Image, oracle: Oracle<string>): Image {
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

export function perlin(): Image {
  const scale = param('Scale', 1);
  const octaves = param('Octaves', 1, intValue(1, numberRangeValidator(1, 8)));

  const renderer = transformed(tuple(scale.value, octaves.value), ([s, o]) => {
    const noise = octaves2d(perlin2d, o);
    return (stack: VecStack, pos: number) => {
      const x = stack.x(pos) * s;
      const y = stack.y(pos) * s;
      const result = perlin_simd_octaves(x, y, o);
      // const result = noise(x, y);
      return stack.push(result, 0, 0, 1);
    }
  });
  return { renderer, settings: value([scale.prop, octaves.prop]) }
}

export function circle(): Image {
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


export function profiles(): Image {
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

export function pointDistance(): Image {
  return { renderer: value((stack: VecStack, pos: number) => stack.push(stack.distance(stack.push(0.5, 0.5, 0, 0), pos), 0, 0, 1)), settings: value([]) };
}

export function sdf(p: (name: string) => Image, oracle: Oracle<string>): Image {
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

export function render(stack: VecStack, p: (name: string) => Image, oracle: Oracle<string>): Image {
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

export function box(p: (name: string) => Image, oracle: Oracle<string>): Image {
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

export function select(p: (name: string) => Image, oracle: Oracle<string>): Image {
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

export function voronoi(stack: VecStack, p: (name: string) => Image, oracle: Oracle<string>): Image {
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
      const cache = new Map<number, [number, number]>();
      const sample = (stack: VecStack, pos: number) => {
        const hash = Vec2Hash([stack.x(pos), stack.y(pos)]);
        const result = cache.get(hash);
        if (result == undefined) {
          const v = stack.call(src, pos);
          cache.set(hash, [stack.x(v), stack.y(v)]);
          return v;
        }
        return stack.push(result[0], result[1], 0, 0);
      }

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
          const v = stack.call(sample, stack.scale(stack.add(c, xy), s1));
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
          const v = stack.call(sample, stack.scale(stack.add(c, xy), s1));
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


function grad(f: (stack: VecStack, pos: number) => number, stack: VecStack, pos: number, d: number) {
  const dx = stack.push(d, 0, 0, 0);
  const dy = stack.push(0, d, 0, 0);
  const d1 = stack.x(f(stack, stack.add(pos, dx)));
  const d2 = stack.x(f(stack, stack.sub(pos, dx)));
  const d3 = stack.x(f(stack, stack.add(pos, dy)));
  const d4 = stack.x(f(stack, stack.sub(pos, dy)));
  return stack.normalize(stack.push(d1 - d2, d3 - d4, d, 0));
}

export function gradient(p: (name: string) => Image, oracle: Oracle<string>): Image {
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

export function displace(p: (name: string) => Image, oracle: Oracle<string>): Image {
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

export function blend(p: (name: string) => Image, oracle: Oracle<string>): Image {
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

export function apply(stack: VecStack, p: (name: string) => Image, oracle: Oracle<string>): Image {
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

export function repeat(p: (name: string) => Image, oracle: Oracle<string>): Image {
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

export function circular(p: (name: string) => Image, oracle: Oracle<string>): Image {
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

export function transform(p: (name: string) => Image, oracle: Oracle<string>): Image {
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

export function grid(stack: VecStack): Image {
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

export function displacedGrid(stack: VecStack, p: (name: string) => Image, oracle: Oracle<string>): Image {
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