import { Timer } from "app/apis/app1";
import { Draft, produce } from "immer";
import { BiConsumer, BiFunction, Consumer, Function, Supplier, Transform, nil } from "./types";

export type ChangeCallback<T> = BiConsumer<T, number>;
export type Disconnector = Consumer<void>

export interface CallbackChannel<T> {
  subscribe(cb: T, lastMods?: number): Disconnector;
}

export interface Source<T> extends CallbackChannel<ChangeCallback<T>> { get(): T, mods(): number }
export interface Destenation<T> { set(value: T): void, modImmer(mod: Consumer<Draft<T>>): void, mod(mod: Transform<T>): void }
export type ConnectedSource<T> = { value: Source<T>, disconnector: Disconnector };

export let GLOBAL_CALLBACK_HANDLERS = 0;

abstract class BaseSource<T> implements Source<T> {
  private handlers = new Set<ChangeCallback<T>>();

  subscribe(cb: ChangeCallback<T>, lastMods?: number): Disconnector {
    GLOBAL_CALLBACK_HANDLERS++;
    if (this.handlers.size === 0) this.firstSubscribe();
    this.handlers.add(cb);
    if (lastMods) {
      const currentMods = this.mods();
      if (lastMods !== currentMods) cb(this.get(), currentMods);
    }
    return () => {
      GLOBAL_CALLBACK_HANDLERS--;
      this.handlers.delete(cb);
      if (this.handlers.size === 0) this.lastDisconnect()
    };
  }

  protected notify(value: T): void { this.handlers.forEach(h => h(value, this.mods())) }

  protected firstSubscribe() {
  }

  protected lastDisconnect() {
  }


  protected hasSubscriptions() { return this.handlers.size !== 0 }
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

export class BaseValue<T> extends BaseSource<T> {
  constructor(
    protected value: T,
    private modsCount = 0
  ) { super() }
  get(): T { return this.value }
  set(newValue: T) { if (this.value !== newValue) { this.value = newValue; this.modsCount++; this.notify(newValue) } }
  modImmer(mod: Consumer<Draft<T>>) { this.set(produce<T>(this.value, draft => { mod(draft) })); }
  mod(mod: Transform<T>) { this.set(mod(this.value)) }
  mods(): number { return this.modsCount }
}

export class Value<T> extends BaseValue<T> implements Destenation<T>, Source<T> {
}

export function value<T>(value: T): Value<T> {
  return new Value<T>(value);
}

class ProxyValue<T> extends Value<T> {
  private disconnector: Disconnector;

  constructor(
    private source: Supplier<T>,
    private signalConnector: Function<Consumer<void>, Disconnector>,
  ) { super(source()) }

  protected firstSubscribe(): void { this.disconnector = this.signalConnector(() => this.set(this.source())) }
  protected lastDisconnect(): void { this.disconnector() }
}

export function proxy<T>(source: Supplier<T>, signal: Function<Consumer<void>, Disconnector>): Value<T> {
  return new ProxyValue<T>(source, signal);
}

class ProxyValueAsync<T> extends Value<T> {
  private disconnector: Disconnector;

  constructor(
    init: T,
    private source: Supplier<Promise<T>>,
    private signalConnector: Function<Consumer<void>, Disconnector>,
  ) { super(init) }

  protected firstSubscribe(): void { this.disconnector = this.signalConnector(async () => this.set(await this.source())) }
  protected lastDisconnect(): void { this.disconnector() }
}

export async function proxyAsync<T>(source: Supplier<Promise<T>>, signal: Function<Consumer<void>, Disconnector>): Promise<Value<T>> {
  return new ProxyValueAsync<T>(await source(), source, signal);
}

export function proxyAsyncImmediate<T>(init: T, source: Supplier<Promise<T>>, signal: Function<Consumer<void>, Disconnector>): Value<T> {
  return new ProxyValueAsync<T>(init, source, signal);
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
  protected lastDisconnect(): void { this.disconnector() }

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

export class TransformValue<S, D> extends BaseValue<D> {
  private disconnector: Disconnector;
  private srcValueDisconnector: Disconnector;
  private lastSrcMods: number;

  constructor(
    private source: Source<S>,
    private transformer: Function<S, D>,
    private srcConnector: BiFunction<S, BaseValue<D>, Disconnector> = _ => nil(),
  ) {
    super(null);
  }

  firstSubscribe(): void {
    this.srcValueDisconnector = this.srcConnector(this.source.get(), this);
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
    if (this.hasSubscriptions()) {
      this.srcValueDisconnector();
      this.srcValueDisconnector = this.srcConnector(value, this);
    }
    this.set(this.transformer(value));
    return this.value;
  }

  lastDisconnect(): void { this.disconnector(); this.srcValueDisconnector() }
  get(): D { return this.lastSrcMods === this.source.mods() ? this.value : this.transform(this.getSrcValue()) }
}

export function transformed<S, D>(
  source: Source<S>,
  transformer: Function<S, D>,
  srcConnector: BiFunction<S, BaseValue<D>, Disconnector> = _ => nil()): TransformValue<S, D> {
  return new TransformValue<S, D>(source, transformer, srcConnector);
}

export class TransformValueAsync<S, D> extends BaseValue<D> {
  private disconnector: Disconnector;
  private srcValueDisconnector: Disconnector;
  private lastSrcMods: number;

  constructor(
    private source: Source<S>,
    private transformer: Function<S, Promise<D>>,
    value: D,
    private srcConnector: BiFunction<S, BaseValue<D>, Disconnector> = _ => nil(),
    private currentId = 0,
  ) {
    super(value);
  }

  firstSubscribe(): void {
    this.srcValueDisconnector = this.srcConnector(this.source.get(), this);
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
    if (this.hasSubscriptions()) {
      this.srcValueDisconnector();
      this.srcValueDisconnector = this.srcConnector(value, this);
    }
    const id = ++this.currentId;
    const nvalue = await this.transformer(value);
    if (id !== this.currentId) return;
    this.set(nvalue);
  }

  get(): D { if (this.lastSrcMods !== this.source.mods()) this.forceReload(); return this.value }
  lastDisconnect(): void { this.disconnector(); this.srcValueDisconnector() }
}


export async function transformedAsync<S, D>(
  source: Source<S>,
  transformer: Function<S, Promise<D>>,
  srcConnector: BiFunction<S, BaseValue<D>, Disconnector> = _ => nil())
  : Promise<TransformValueAsync<S, D>> {
  return new TransformValueAsync<S, D>(source, transformer, await transformer(source.get()), srcConnector);
}

export function transformedAsyncImmediate<S, D>(
  source: Source<S>, init: D,
  transformer: Function<S, Promise<D>>,
  srcConnector: BiFunction<S, BaseValue<D>, Disconnector> = _ => nil())
  : TransformValueAsync<S, D> {
  return new TransformValueAsync<S, D>(source, transformer, init, srcConnector);
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

export class ComplexSource1<T, U> extends BaseSource<T> {
  private topDisconnector: Disconnector;
  private disconnector: Disconnector;

  constructor(
    init: T,
    private source: Source<U>,
    private loader: Function<U, Promise<T>>,
    private connect: BiFunction<U, Value<T>, Disconnector>,
    private valueImpl = value(init),
  ) {
    super();
    this.reload(source.get());
  }

  private async reload(value: U) {
    this.valueImpl.set(await this.loader(value));
  }

  protected firstSubscribe(): void {
    this.disconnector = this.connect(this.source.get(), this.valueImpl);
    this.topDisconnector = this.source.subscribe(u => {
      this.disconnector?.();
      this.reload(u);
      this.disconnector = this.connect(u, this.valueImpl);
    });
  }

  protected lastDisconnect(): void {
    this.disconnector?.();
    this.topDisconnector();
  }

  get(): T {
    return this.valueImpl.get();
  }

  mods(): number {
    return this.valueImpl.mods();
  }
}

export async function complexSource1<T, U>(source: Source<U>, loader: Function<U, Promise<T>>, connect: BiFunction<U, Value<T>, Disconnector>): Promise<ComplexSource1<T, U>> {
  const init = await loader(source.get());
  return new ComplexSource1<T, U>(init, source, loader, connect);
}