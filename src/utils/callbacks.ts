import { Timer } from "app/apis/app1";
import { Draft, produce } from "immer";
import { BiConsumer, Consumer, Function, Supplier, Transform, nil } from "./types";

export type ChangeCallback<T> = BiConsumer<T, number>;
export type Disconnector = Consumer<void>

export interface CallbackChannel<T> {
  subscribe(cb: T, lastMods?: number): Disconnector;
}

export interface Source<T> extends CallbackChannel<ChangeCallback<T>> { get(): T, mods(): number }
export interface Destenation<T> { set(value: T): void, modImmer(mod: Consumer<Draft<T>>): void, mod(mod: Transform<T>): void }
export type ConnectedSource<T> = { value: Source<T>, disconnector: Disconnector };

abstract class BaseSource<T> implements Source<T> {
  protected handlers = new Set<ChangeCallback<T>>();

  subscribe(cb: ChangeCallback<T>, lastMods?: number): Disconnector {
    if (this.handlers.size === 0) this.firstSubscribe();
    this.handlers.add(cb);
    if (lastMods) {
      const currentMods = this.mods();
      if (lastMods !== currentMods) cb(this.get(), currentMods);
    }
    return () => {
      this.handlers.delete(cb);
      if (this.handlers.size === 0) this.lastDisconnect()
    };
  }

  notify(value: T): void { this.handlers.forEach(h => h(value, this.mods())) }

  firstSubscribe() {
  }

  lastDisconnect() {
  }

  abstract get(): T;
  abstract mods(): number;
}

class ConstSource<T> implements Source<T> {
  constructor(private value: T) { }
  get(): T { return this.value }
  mods(): number { return 0 }
  subscribe(_: ChangeCallback<T>): Disconnector { return nil() }
}

export function constSource<T>(val: T): Source<T> {
  return new ConstSource<T>(val);
}

export class Value<T> extends BaseSource<T> implements Destenation<T>, Source<T> {
  constructor(private value: T, private modsCount = 0) { super() }
  get(): T { return this.value }
  set(newValue: T) { if (this.value !== newValue) { this.value = newValue; this.modsCount++; this.notify(newValue) } }
  modImmer(mod: Consumer<Draft<T>>) { this.set(produce<T>(this.value, draft => { mod(draft) })); }
  mod(mod: Transform<T>) { this.set(mod(this.value)) }
  mods(): number { return this.modsCount }
}

export function value<T>(value: T): Value<T> {
  return new Value<T>(value);
}

export function subscribe<T>(loader: Supplier<T>, subscriber: Function<Consumer<void>, Disconnector>): ConnectedSource<T> {
  const val = value(loader());
  const disconnector = subscriber(() => val.set(loader()));
  return { value: val, disconnector };
}

export class DelayedSource<T> extends BaseSource<T> {
  private timerId = -1;
  private last = -1;
  private disconnector: Disconnector;

  constructor(
    private src: Source<T>,
    private delayMs: number,
    private timer: Timer,
  ) {
    super();
  }

  get(): T { return this.src.get() }
  mods(): number { return this.src.mods() }

  firstSubscribe(): void {
    this.disconnector = this.src.subscribe((v, mods) => this.notify(v));
  }

  notify(value: T) {
    const now = this.timer();
    const dt = now - this.last;
    if (dt > this.delayMs) this.notifyImpl(value, now);
    else {
      if (this.timerId !== -1) window.clearTimeout(this.timerId);
      this.timerId = window.setTimeout(() => {
        this.timerId = -1;
        this.notifyImpl(this.src.get(), this.timer());
      }, dt);
    }
  }

  private notifyImpl(value: T, now: number) {
    super.notify(value);
    this.last = now;
    if (this.timerId !== -1) window.clearTimeout(this.timerId);
  }
}

export function delayed<T>(src: Source<T>, delayMs: number, timer: Timer) {
  return new DelayedSource<T>(src, delayMs, timer);
}

export class TransformValue<S, D> extends BaseSource<D> implements Source<D> {
  private value: D;
  private disconnector: Disconnector;
  private modsCount = 0;
  private lastSrcMods: number;

  constructor(
    private source: Source<S>,
    private transformer: Function<S, D>
  ) {
    super();
  }

  firstSubscribe(): void {
    this.disconnector = this.source.subscribe((v, mods) => {
      this.lastSrcMods = mods;
      this.transform(v);
    }, this.lastSrcMods);
  }

  private getSrcValue(): S {
    this.lastSrcMods = this.source.mods();
    return this.source.get();
  }

  private transform(value: S): D {
    const nvalue = this.transformer(value);
    if (nvalue !== this.value) {
      this.value = nvalue;
      this.modsCount++;
      this.notify(this.value)
    }
    return this.value;
  }

  mods(): number { return this.modsCount }
  lastDisconnect(): void { this.disconnector() }
  get(): D { return this.lastSrcMods === this.source.mods() ? this.value : this.transform(this.getSrcValue()) }
}

export function transformed<S, D>(source: Source<S>, transformer: Function<S, D>): TransformValue<S, D> {
  return new TransformValue<S, D>(source, transformer);
}

export class TransformValueAsync<S, D> extends BaseSource<D> implements Source<D> {
  private disconnector: Disconnector;
  private modsCount = 0;
  private lastSrcMods: number;

  constructor(
    private source: Source<S>,
    private transformer: Function<S, Promise<D>>,
    private value: D,
    private currentId = 0,
  ) {
    super();
  }

  firstSubscribe(): void {
    this.disconnector = this.source.subscribe((v, mods) => {
      this.lastSrcMods = mods;
      this.reloadImpl(v);
    }, this.lastSrcMods);
  }

  async forceReload() {
    this.lastSrcMods = this.source.mods();
    this.reloadImpl(this.source.get());
  }

  private async reloadImpl(value: S) {
    const id = ++this.currentId;
    const nvalue = await this.transformer(value);
    if (id !== this.currentId) return;
    if (nvalue !== this.value) {
      this.value = nvalue;
      this.modsCount++;
      this.notify(this.value)
    }
  }

  get(): D { if (this.lastSrcMods !== this.source.mods()) this.forceReload(); return this.value }
  mods(): number { return this.modsCount }
  lastDisconnect(): void { this.disconnector() }
}


export async function transformedAsync<S, D>(source: Source<S>, transformer: Function<S, Promise<D>>): Promise<TransformValueAsync<S, D>> {
  return new TransformValueAsync<S, D>(source, transformer, await transformer(source.get()));
}

export function transformedAsyncImmediate<S, D>(source: Source<S>, init: D, transformer: Function<S, Promise<D>>): TransformValueAsync<S, D> {
  return new TransformValueAsync<S, D>(source, transformer, init);
}


type SourceCallbacklChannelfy<T> = { [P in keyof T]: Source<T[P]> };
export class Tuple<Args extends any[]> extends BaseSource<Args> implements Source<Args> {
  private sources: SourceCallbacklChannelfy<Args>[number][];
  private disconnectors: Disconnector[];
  private modCount = 0;

  constructor(...sources: SourceCallbacklChannelfy<Args>) {
    super();
    this.sources = [...sources];
  }

  firstSubscribe(): void {
    this.disconnectors = this.sources.map(s => s.subscribe((v, hash) => {
      this.modCount++;
      this.notify(this.get());
    }))
  }

  lastDisconnect(): void { this.disconnectors.forEach(d => d()) }
  mods(): number { return this.modCount }
  get(): Args { return this.sources.map(v => v.get()) as Args }
}

export function tuple<Args extends any[]>(...sources: SourceCallbacklChannelfy<Args>): Tuple<Args> {
  return new Tuple<Args>(...sources);
}