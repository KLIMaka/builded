import { match } from "ts-pattern";
import { Value } from "./callbacks";
import { takeFirst } from "./collections";
import { cyclic } from "./mathutils";
import { BiFunction, Function, Supplier } from "./types";

export type NavigateAction = 'nop' | 'next' | 'prev' | 'nextMicro' | 'prevMicro' | 'nextMacro' | 'prevMacro' | 'start' | 'end';
export type Navigator = Function<NavigateAction, Promise<void>>;
export const EMPTY_NAVIGATOR: Navigator = async _ => { };

export function navigateList<T>(value: Value<T>, listSupplier: Supplier<T[]>, wrap: BiFunction<number, number, number> = cyclic, macroStep = 10): Navigator {
  const navigate = async (type: NavigateAction) => {
    if (type === 'nop') return;
    const list = listSupplier();
    const currentValue = value.get();
    const currentId = list.indexOf(currentValue);
    if (currentId === -1) {
      takeFirst(list).ifPresent(first => value.set(first))
    } else {
      const newId = match(type)
        .with('next', 'nextMicro', () => wrap(currentId + 1, list.length))
        .with('prev', 'prevMicro', () => wrap(currentId - 1, list.length))
        .with('nextMacro', () => wrap(currentId + macroStep, list.length))
        .with('prevMacro', () => wrap(currentId - macroStep, list.length))
        .with('start', () => 0)
        .with('end', () => list.length - 1)
        .exhaustive();
      value.set(list[newId]);
    }
  }
  return navigate;
}