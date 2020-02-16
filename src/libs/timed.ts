import { Range, Interpolator } from "../modules/interpolator";

export type TimedValue<T> = (time: number) => T;

export function constTimed<T>(value: T): TimedValue<T> { return () => value }

export function timed<T>(startTime: number, startValue: T, endTime: number, endValue: T, interpolator: Interpolator<T>): TimedValue<T> {
  const range = new Range(startValue, endValue, interpolator);
  const dt = endTime - startTime;
  return (time: number) => {
    const t = (time - startTime) / dt;
    return range.get(t);
  }
}

export function delayed<T>(dt: number, last: T, next: T, inter: Interpolator<T>): TimedValue<T> {
  const now = performance.now();
  return timed(now, last, now + dt, next, inter);
}

export class DelayedValue<T> {
  private value: TimedValue<T>;

  constructor(private delay: number, private start: T, private inter: Interpolator<T>) {
    this.value = constTimed(start);
  }

  public set(val: T) {
    const now = performance.now();
    const last = this.value(now);
    this.value = delayed(this.delay, last, val, this.inter);
  }

  public get() {
    return this.value(performance.now());
  }
}