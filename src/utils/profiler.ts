import { TIMER, Timer as Timer_ } from "../app/apis/app";
import { Dependency, Injector, Plugin, provider } from "utils/injector";
import { getOrCreate } from "./collections";

export const DefaultProfilerConstructor: Plugin<Profiler> = provider(async (injector: Injector) => {
  const timer = await injector.getInstance(TIMER);
  return new DefaultProfiler(timer);
});


export interface Timer {
  start(): Timer;
  stop(): Timer;
  get(): number;
  print(): string;
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
  timer(): Timer;
}

export const PROFILER = new Dependency<Profiler>('Profiler');

export class DefaultTimer implements Timer {
  private time = 0;
  private startTime = -1;

  constructor(private timer: Timer_) { };

  get() { return this.startTime != -1 ? this.timer() - this.startTime : this.time }

  start() {
    if (this.startTime == -1) this.startTime = this.timer();
    return this;
  }

  stop() {
    if (this.startTime != -1) {
      this.time = this.timer() - this.startTime;
      this.startTime = -1;
    }
    return this;
  }

  print() {
    const t = this.get();
    if (t <= 500) return t.toFixed(2) + 'ms';
    return (t / 1000).toFixed(2) + 'sec';
  }
}

export class DefaultCounter implements Counter {
  private count = 0;
  inc() { this.count++; return this; }
  incAmount(amount: number) { this.count += amount; return this; }
  set(value: number) { this.count = value; return this; }
  get(): number { return this.count }
}

export class DefaultProfile implements Profile {
  private timers = new Map<string, Timer>();
  private counters = new Map<string, Counter>();

  constructor(private t: Timer_) { }

  timer(name: string): Timer { return getOrCreate(this.timers, name, _ => new DefaultTimer(this.t)) }
  counter(name: string): Counter { return getOrCreate(this.counters, name, _ => new DefaultCounter()) }
}

export class DefaultProfiler implements Profiler {
  private globalProfile: Profile;
  private frameProfile: Profile;

  constructor(private t: Timer_) {
    this.globalProfile = new DefaultProfile(t);
    this.frameProfile = new DefaultProfile(t);
  }

  global() { return this.globalProfile }
  frame() { return this.frameProfile }
  frameStart() { this.frameProfile = new DefaultProfile(this.t) }
  timer() { return new DefaultTimer(this.t) }
}