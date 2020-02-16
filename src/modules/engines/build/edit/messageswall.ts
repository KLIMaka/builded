import { Message } from "../handlerapi";
import { BuildContext } from "../api";
import { WallStats, Wall } from "../structs";

export type WallProcessor = (wallId: number, ctx: BuildContext) => boolean;
export class WallMesage implements Message { constructor(public proc: WallProcessor) { } }

interface WallAccessor {
  get(wallId: number, ctx: BuildContext): number;
  set(wallId: number, ctx: BuildContext, value: number): void;
}

const cstat = (name: keyof WallStats) => <WallAccessor>{
  get: (wallId: number, ctx: BuildContext) => ctx.board.walls[wallId].cstat[name],
  set: (wallId: number, ctx: BuildContext, value: number) => ctx.board.walls[wallId].cstat[name] = value
}

const wall = (name: "picnum" | "overpicnum" | "shade" | "pal" | "xrepeat" | "yrepeat" | "xpanning" | "ypanning" | "lotag" | "hitag") => <WallAccessor>{
  get: (wallId: number, ctx: BuildContext) => ctx.board.walls[wallId][name],
  set: (wallId: number, ctx: BuildContext, value: number) => ctx.board.walls[wallId][name] = value
}

const onoff = (value: number) => value == 1 ? 0 : 1;
const inc = (value: number) => value + 1;
const dec = (value: number) => value - 1;


export function setter(
  accessor: WallAccessor,
  valueProvider: () => number) {
  return (wallId: number, ctx: BuildContext): boolean => {
    let pval = accessor.get(wallId, ctx);
    let value = valueProvider();
    if (pval == value) return false;
    accessor.set(wallId, ctx, value);
    return true;
  }
}

export function toggler(
  accessor: WallAccessor,
  toggler: (value: number) => number) {
  return (wallId: number, ctx: BuildContext): boolean => {
    let value = accessor.get(wallId, ctx);
    accessor.set(wallId, ctx, toggler(value));
    return true;
  }
}


const alignBottomToggle = toggler(cstat('alignBottom'), onoff);
const picnum = (picnum: number) => setter(wall('picnum'), () => picnum);
const shade_plus = toggler(wall('shade'), inc);
const shade_minus = toggler(wall('shade'), dec);