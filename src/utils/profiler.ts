import { Dependency } from "./injector";

function now() {
  return window.performance.now();
}

export interface Timer {
  start(): Timer;
  stop(): Timer;
  get(): number;
}

export interface Counter {
  inc(): Counter;
  incAmount(amount: number): Counter;
  set(values: number): Counter;
  get(): number;
}

export interface Profile {
  timer(name: string): Timer;
  counter(name: string): Counter;
}

export interface Profiler {
  global(): Profile;
  frame(): Profile;
  frameStart(): void;
}

export const PROFILER = new Dependency<Profiler>('Profiler');

export class DefaultTimer implements Timer {
  private time = 0;
  private startTime = -1;

  get() { return this.startTime != -1 ? now() - this.startTime : this.time }
  start() {
    if (this.startTime == -1) this.startTime = now();
    return this;
  }
  stop() {
    if (this.startTime != -1) {
      this.time = now() - this.startTime;
      this.startTime = -1;
    }
    return this;
  }
}

export class DefaultCounter implements Counter {
  private count = 0;
  inc() { this.count++; return this; }
  incAmount(amount: number) { this.count += amount; return this; }
  set(value: number) { this.count = value; return this; }
  get(): number { return this.count }
}

function ensure<T>(map: Map<string, T>, key: string, constructor: () => T) {
  let value = map.get(key);
  if (value == undefined) {
    value = constructor();
    map.set(key, value);
  }
  return value;
}

export class DefaultProfile implements Profile {
  private timers = new Map<string, Timer>();
  private counters = new Map<string, Counter>();

  timer(name: string): Timer { return ensure(this.timers, name, () => new DefaultTimer()) }
  counter(name: string): Counter { return ensure(this.counters, name, () => new DefaultCounter()) }
}

export class DefaultProfiler implements Profiler {
  private globalProfile = new DefaultProfile();
  private frameProfile = new DefaultProfile();

  global() { return this.globalProfile }
  frame() { return this.frameProfile }
  frameStart() { this.frameProfile = new DefaultProfile() }
}