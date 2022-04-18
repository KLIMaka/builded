import { handle, value } from "../../../../utils/callbacks";
import { int } from "../../../../utils/mathutils";
import { VecStack } from "../../../../utils/vecstack";
import { Context, Image } from "../api";
import { param, VOID_RENDERER } from "./common";

type Moulding = (x: number) => number;
type MouldingPart = { moulding: Moulding, width: number, height: number, hoffset: number, woffset: number }

const LISTEL: Moulding = x => 1;
const QUARTER_ROUND: Moulding = x => Math.sqrt(1 - x * x);
const SPLAY: Moulding = x => x;
const CYMA_RECTA: Moulding = x => x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x);
const CYMA_REVERSA: Moulding = x => x < 0.5 ? 0.5 * Math.sqrt(2 * x) : 1 - 0.5 * Math.sqrt(2 - 2 * x);

export function mouldings(ctx: Context): Image {
  const size = param('Size', 4);
  const props = [size.prop];

  const renderer = value(VOID_RENDERER);
  const settings = value(props);

  handle(null, (p, size_) => {
    const parts = parseMouldings('+\\:1,1,3;-\\:2,2,1;_/-:4,2,1;+\\:2,2,1');
    const size = parts.length;
    const d = 1 / size;
    renderer.set((stack: VecStack, pos: number) => {
      const x = stack.x(pos);
      if (x < 0 || x >= 1.0) return stack.pushScalar(0);
      const idx = int(x * size);
      const part = parts[idx];
      const lx = (x - part.woffset * d) / (part.width * d);
      const y = part.hoffset * d + part.moulding(lx) * part.height * d;
      return stack.pushScalar(y);
    });
  }, size.value);

  return { renderer, settings, dependsOn: _ => false };
}

function parseMoulding(str: string): Moulding {
  switch (str) {
    case '/': return SPLAY;
    case '\\': return x => SPLAY(1 - x);
    case '+/': return x => QUARTER_ROUND(1 - x);
    case '-/': return x => 1 - QUARTER_ROUND(x);
    case '-\\': return x => 1 - QUARTER_ROUND(1 - x);
    case '+\\': return QUARTER_ROUND;
    case '_/-': return CYMA_RECTA;
    case '-\\_': return x => CYMA_RECTA(1 - x);
    case '|/|': return CYMA_REVERSA;
    case '|\\|': return x => CYMA_REVERSA(1 - x);
    default: return LISTEL;
  }
}

function parseMouldings(str: string): MouldingPart[] {
  const result: MouldingPart[] = [];
  let woff = 0;
  for (const p of str.split(';')) {
    const [m, params] = p.split(':');
    const [w, h, hoff] = params.split(',').map(Number.parseFloat);
    const part: MouldingPart = {
      moulding: parseMoulding(m),
      width: w,
      height: h,
      woffset: woff,
      hoffset: hoff
    };
    for (let i = 0; i < w; i++) result.push(part);
    woff += w;
  }
  return result;
}