import { DelayedTask, Timer } from "app/apis/app1";
import { Draft, produce } from "immer";
import Optional from "optional-js";
import { DirectionalGraph } from "./graph";
import { iter } from "./iter";
import { objectKeys } from "./objects";
import { BiConsumer, BiFunction, BiPredicate, Consumer, Function, MultiFunction, SingleTuple, Supplier, Transform, identity, nil, refEq, result, resultAsync, second, secondArg } from "./types";

export type ChangeCallback<T> = BiConsumer<T, number>;
export type Disconnector = Consumer<void>;

function arrayEqImpl(arr1: any[], arr2: any, eqf: BiPredicate<any, any> = (l, r) => l === r): boolean {
  if (arr1 === null || arr2 === null) return false;
  if (arr1.length !== arr2.length) return false;
  for (let i = 0; i < arr1.length; i++)
    if (!eqf(arr1[i], arr2[i])) return false;
  return true;
}

export function arrayEq<T>(arr1: T[], arr2: T[], eqf: BiPredicate<T, T> = (l, r) => l === r): boolean {
  return arrayEqImpl(arr1, arr2, eqf);
}

export function objectEq(obj1: any, obj2: any): boolean {
  if (!arrayEqImpl(Object.keys(obj1), Object.keys(obj2))) return false;
  for (const k in obj1)
    if (obj1[k] !== obj2[k]) return false;
  return true;
}

export type Signal<Args extends any[] = []> = {
  call(...args: Args): void;
  subscribe(handler: Consumer<Args>): Disconnector,
}

export interface Source<T> {
  readonly name: string;

  get(): T,
  mods(): number,
  subscribe(cb: ChangeCallback<T>, lastMods?: number): Disconnector,
  depends(value: any): boolean;
}

export interface Destination<T> {
  set(value: T): void,
  setPromiseOrDispose(mod: Function<T, Promise<T>>): Promise<boolean>,
  modImmer(mod: Consumer<Draft<T>>): void,
  mod(mod: Transform<T>): void
}

export type Disposable = { dispose(): Promise<void> };

export function disposable(disconnector: Disconnector): Disposable {
  return { dispose: async () => disconnector() }
}

export function dispose(...disp: Disposable[]): void {
  disp.forEach(d => d.dispose())
}
abstract class BaseSource<T> implements Source<T> {
  private handlers = new Set<ChangeCallback<T>>();

  constructor(readonly name: string = '') { }

  subscribe(cb: ChangeCallback<T>, lastMods?: number): Disconnector {
    if (!this.hasSubscriptions()) this.firstSubscribe();
    if (lastMods) {
      const currentMods = this.mods();
      if (lastMods !== currentMods) cb(this.get(), currentMods);
    }
    this.handlers.add(cb);
    return () => {
      this.handlers.delete(cb);
      if (!this.hasSubscriptions()) this.lastDisconnect()
    };
  }

  protected firstSubscribe() { }
  protected lastDisconnect() { }
  protected hasSubscriptions() { return this.handlers.size !== 0 }
  protected notify(value: T, mods: number): void { this.handlers.forEach(h => h(value, mods)) }

  abstract get(): T;
  abstract mods(): number;
  abstract depends(value: any): boolean;
}

export function throttled<T>(cb: ChangeCallback<T>, minDelayMs: number, timer: Timer): ChangeCallback<T> {
  let last = 0;
  let delayed: DelayedTask;
  return (value, mods) => {
    const now = timer.now();
    const addDelay = minDelayMs + last - now;
    delayed?.cancel();
    if (addDelay <= 0) cb(value, mods);
    else delayed = timer.delayed(() => { cb(value, mods); last = timer.now() }, addDelay);
    last = now;
  }
}

class ConstSource<T> implements Source<T>, Disposable {
  constructor(
    readonly name: string = '',
    private value: T,
    private disposer: Consumer<T>
  ) { }
  get(): T { return this.value }
  mods(): number { return 0 }
  depends(value: any): boolean { return false }
  subscribe(_: ChangeCallback<T>): Disconnector { return nil() }
  async dispose(): Promise<void> { this.disposer(this.value) }
}

export function constSource<T>(name: string, val: T, disposer: Consumer<T> = nil()): ConstSource<T> {
  return new ConstSource<T>(name, val, disposer);
}

export interface ValueBuilder<T> {
  readonly name?: string,
  readonly value: T,
  readonly disposer?: Consumer<T>,
  readonly eq?: BiPredicate<T, T>,
  readonly setter?: BiFunction<T, T, T>
}

export class BaseValue<T> extends BaseSource<T> implements Disposable {
  constructor(
    builder: ValueBuilder<T>,
    protected value = builder.value,
    private disposer = builder.disposer ?? nil(),
    private eq = builder.eq ?? refEq(),
    private settter = builder.setter ?? secondArg(),
    private modsCount = 0,
  ) { super(builder.name) }

  set(newValue: T) {
    if (!this.isSameValue(newValue))
      this.setImpl(newValue);
  }

  async setPromiseOrDispose(mod: Function<T, Promise<T>>): Promise<boolean> {
    const startMods = this.mods();
    const nvalue = await mod(this.get());
    if (this.mods() !== startMods) {
      this.disposeValue(nvalue);
      return false;
    } else {
      this.setOrDispose(nvalue);
      return true;
    }
  }

  private setImpl(newValue: T) {
    this.disposeValue(this.value);
    this.value = this.settter(this.value, newValue);
    this.modsCount++;
    this.notify(this.value, this.modsCount);
  }

  protected setOrDispose(newValue: T) {
    if (this.value === newValue) return;
    else if (this.eq(this.value, newValue)) {
      this.disposeValue(newValue);
    } else this.setImpl(newValue);
  }

  protected isSameValue(value: T) {
    return this.value === value || this.eq(this.value, value);
  }

  async dispose() {
    if (this.hasSubscriptions())
      throw new Error(`Value '${this.name}' has subscriptions`);
    this.disposeValue(this.value);
    this.value = null;
  }

  get(): T { return this.value }
  modImmer(mod: Consumer<Draft<T>>) { this.set(produce<T>(this.value, draft => { mod(draft) })); }
  mod(mod: Transform<T>) { this.set(mod(this.value)) }
  mods(): number { return this.modsCount }
  depends(value: any): boolean { return false }
  protected disposeValue(value: T) { this.disposer(value) }
}

export class Value<T> extends BaseValue<T> implements Destination<T>, Source<T> { }

export class ValuesMap<T> {
  constructor(private map: Map<keyof T, Value<T[keyof T]>>) { }
  get<K extends keyof T>(key: K): Value<T[K]> { return this.map.get(key) as Value<T[K]> }
  getObject(): T { return iter(this.map.keys()).toObject<T>(identity(), k => this.map.get(k).get()) }
  set(values: T) { iter(this.map.entries()).forEach(([k, v]) => v.set(values[k])) }
  handle(values: ValuesContainer, handler: Consumer<T>) {
    iter(this.map.values()).forEach(v => values.handleStandalone([v], _ => handler(this.getObject())))
  }
}

export function toValuesMap<T>(obj: T, values: ValuesContainer): ValuesMap<T> {
  return new ValuesMap(iter(objectKeys(obj)).toMap(identity(), k => values.value(k.toString(), obj[k])));
}


export function valueBuilder<T>(builder: ValueBuilder<T>): Value<T> {
  return new Value<T>(builder);
}

export function value<T>(name: string, value: T): Value<T> {
  return valueBuilder({ name, value });
}

export interface ProxyValueBuilder<T> extends ValueBuilder<T> {
  readonly source: Supplier<T>,
  readonly signalConnector: Function<Consumer<void>, Disconnector>
}

class ProxyValue<T> extends BaseValue<T> {
  private source: Supplier<T>;
  private signalConnector: Function<Consumer<void>, Disconnector>;
  private disconnector: Disconnector;

  constructor(builder: ProxyValueBuilder<T>) {
    super(builder)
    this.source = builder.source;
    this.signalConnector = builder.signalConnector;
  }

  protected firstSubscribe(): void { this.disconnector = this.signalConnector(() => this.set(this.source())) }
  protected lastDisconnect(): void { this.disconnector() }
}

export function proxyBuilder<T>(builder: ProxyValueBuilder<T>): ProxyValue<T> {
  return new ProxyValue<T>(builder);
}

export function proxy<T>(source: Supplier<T>, signalConnector: Function<Consumer<void>, Disconnector>): ProxyValue<T> {
  return proxyBuilder({ value: source(), source, signalConnector });
}

export interface ProxyValueAsyncBuilder<T> extends ValueBuilder<T> {
  readonly source: Supplier<Promise<T>>,
  readonly signalConnector: Function<Consumer<void>, Disconnector>
}

class ProxyValueAsync<T> extends Value<T> {
  private source: Supplier<Promise<T>>;
  private signalConnector: Function<Consumer<void>, Disconnector>;
  private disconnector: Disconnector;

  constructor(builder: ProxyValueAsyncBuilder<T>) {
    super(builder)
    this.source = builder.source;
    this.signalConnector = builder.signalConnector;
  }

  protected firstSubscribe(): void { this.disconnector = this.signalConnector(async () => this.set(await this.source())) }
  protected lastDisconnect(): void { this.disconnector() }
}

export function proxyAsyncBuilder<T>(builder: ProxyValueAsyncBuilder<T>): ProxyValueAsync<T> {
  return new ProxyValueAsync<T>(builder);
}

export async function proxyAsync<T>(source: Supplier<Promise<T>>, signalConnector: Function<Consumer<void>, Disconnector>): Promise<ProxyValueAsync<T>> {
  return proxyAsyncBuilder({ value: await source(), source, signalConnector });
}

export function proxyAsyncImmediate<T>(value: T, source: Supplier<Promise<T>>, signalConnector: Function<Consumer<void>, Disconnector>): ProxyValueAsync<T> {
  return proxyAsyncBuilder({ value, source, signalConnector });
}

export interface TransformValueBuilder<S extends any[], D> extends ValueBuilder<D> {
  readonly source: Source<SingleTuple<S>>,
  readonly transformer: MultiFunction<[SingleTuple<S>, D], D>,
  readonly srcConnector?: BiFunction<SingleTuple<S>, BaseValue<D>, Disconnector>,
}

export const TRANSFORM_PLACEHOLDER = {};

export class TransformValue<S extends any[], D> extends BaseValue<D> {
  private source: Source<SingleTuple<S>>;
  private transformer: BiFunction<SingleTuple<S>, D, D>;
  private srcValueConnector: BiFunction<SingleTuple<S>, BaseValue<D>, Disconnector>;
  private srcValueDisconnector: Disconnector;
  private disconnector: Disconnector;
  private lastSrcMods: number;

  constructor(builder: TransformValueBuilder<S, D>) {
    super(builder);
    this.source = builder.source;
    this.transformer = builder.transformer;
    this.srcValueConnector = builder.srcConnector ?? (_ => nil());
  }

  firstSubscribe(): void {
    this.actualize();
    this.srcValueDisconnector = this.srcValueConnector(this.source.get(), this);
    this.disconnector = this.source.subscribe((v, mods) => this.transform(v, mods), this.lastSrcMods);
  }

  lastDisconnect(): void {
    this.disconnector();
    this.srcValueDisconnector()
  }

  set(newValue: D): void {
    if (this.value === TRANSFORM_PLACEHOLDER) this.value = newValue;
    else super.set(newValue);
  }

  protected setOrDispose(newValue: D): void {
    if (this.value === TRANSFORM_PLACEHOLDER) this.value = newValue;
    else super.setOrDispose(newValue);
  }

  protected disposeValue(value: D): void {
    if (value === TRANSFORM_PLACEHOLDER) return;
    super.disposeValue(value);
  }

  private transform(value: SingleTuple<S>, mods: number): D {
    if (this.hasSubscriptions()) {
      this.srcValueDisconnector();
      this.srcValueDisconnector = this.srcValueConnector(value, this);
    }
    const nvalue = this.transformer(value, this.value);
    this.setOrDispose(nvalue);
    this.lastSrcMods = mods;
    return super.get();
  }

  private actualize() {
    if (this.hasSubscriptions() && this.value !== TRANSFORM_PLACEHOLDER) return;
    const srcMods = this.source.mods();
    if (this.lastSrcMods !== srcMods)
      this.transform(this.source.get(), srcMods);
  }

  mods(): number {
    this.actualize();
    return super.mods()
  }

  get(): D {
    this.actualize();
    return super.get()
  }

  depends(value: any): boolean {
    return this.source === value || this.source.depends(value);
  }
}

export function transformedBuilder<S extends any[], D>(builder: TransformValueBuilder<S, D>): TransformValue<S, D> {
  return new TransformValue<S, D>(builder);
}

export function transformed<S, D>(
  source: Source<S>,
  transformer: Function<S, D>,
  srcConnector?: BiFunction<S, BaseValue<D>, Disconnector>): TransformValue<[S], D> {
  return transformedBuilder<[S], D>({ source, transformer, srcConnector, value: TRANSFORM_PLACEHOLDER as D });
}

export type TransformedInitialValue<T> = {
  value: T,
  mods: number,
}

export function initial<T>(value: T): TransformedInitialValue<T> {
  return { value, mods: -1 };
}

export interface TransformValueAsyncBuilder<S extends any[], D> extends Omit<ValueBuilder<D>, 'value'> {
  readonly source: Source<SingleTuple<S>>,
  readonly initialValue?: TransformedInitialValue<D>;
  readonly transformer: Function<SingleTuple<S>, Promise<D>>,
  readonly srcConnector?: BiFunction<SingleTuple<S>, BaseValue<D>, Disconnector>,
}

export class TransformValueAsync<S extends any[], D> extends BaseValue<D> {
  private source: Source<S>;
  private transformer: Function<S, Promise<D>>;
  private srcValueConnector: BiFunction<S, BaseValue<D>, Disconnector>;
  private disconnector: Disconnector;
  private srcValueDisconnector: Disconnector;
  private lastSrcMods: number;
  private currentId = 0;

  constructor(builder: TransformValueAsyncBuilder<S, D>) {
    super({ ...builder, value: builder.initialValue?.value ?? TRANSFORM_PLACEHOLDER as D });
    this.source = builder.source;
    this.lastSrcMods = builder.initialValue?.mods ?? undefined;
    this.transformer = builder.transformer;
    this.srcValueConnector = builder.srcConnector ?? (_ => nil());
  }

  firstSubscribe(): void {
    this.actualize();
    this.srcValueDisconnector = this.srcValueConnector(this.source.get(), this);
    this.disconnector = this.source.subscribe((v, mods) => this.reloadImpl(v, mods), this.lastSrcMods);
  }

  lastDisconnect(): void {
    this.disconnector();
    this.srcValueDisconnector();
  }

  async dispose(): Promise<void> {
    ++this.currentId;
    return super.dispose();
  }

  async forceReload() {
    await this.reloadImpl(this.source.get(), this.source.mods());
  }

  private async reloadImpl(value: S, mods: number) {
    if (this.hasSubscriptions()) {
      this.srcValueDisconnector();
      this.srcValueDisconnector = this.srcValueConnector(value, this);
    }
    const id = ++this.currentId;
    this.lastSrcMods = mods;
    const nvalue = await this.transformer(value);
    if (id !== this.currentId) this.disposeValue(nvalue);
    else this.setOrDispose(nvalue);
  }

  private actualize() {
    if (this.hasSubscriptions() && this.value !== TRANSFORM_PLACEHOLDER) return;
    if (this.lastSrcMods !== this.source.mods())
      this.forceReload();
  }

  mods(): number {
    this.actualize();
    return super.mods()
  }

  get(): D {
    this.actualize();
    return super.get()
  }

  depends(value: any): boolean {
    return this.source === value || this.source.depends(value);
  }

  set(newValue: D): void {
    if (this.value === TRANSFORM_PLACEHOLDER) this.value = newValue;
    else super.set(newValue);
  }

  protected setOrDispose(newValue: D): void {
    if (this.value === TRANSFORM_PLACEHOLDER) this.value = newValue;
    else super.setOrDispose(newValue);
  }

  protected disposeValue(value: D): void {
    if (value === TRANSFORM_PLACEHOLDER) return;
    super.disposeValue(value);
  }
}


export function transformedAsyncBuilder<S extends any[], D>(builder: TransformValueAsyncBuilder<S, D>): TransformValueAsync<S, D> {
  return new TransformValueAsync(builder);
}

export async function transformedAsync<S, D>(
  name: string,
  source: Source<S>,
  transformer: Function<S, Promise<D>>,
  srcConnector: BiFunction<S, BaseValue<D>, Disconnector> = _ => nil())
  : Promise<TransformValueAsync<[S], D>> {
  const value = await transformer(source.get());
  const mods = source.mods();
  return transformedAsyncBuilder<[S], D>({ name, source, transformer, srcConnector, initialValue: { value, mods } });
}

type SourcefyArray<T> = { [P in keyof T]: Source<T[P]> };
export interface TupleBuilder<Args extends any[]> extends Omit<ValueBuilder<Args>, 'value'> {
  sources: SourcefyArray<Args>,
}

const TUPLE_PLACEHOLDER = []

class Tuple<Args extends any[]> extends BaseValue<Args> {
  private sources: SourcefyArray<Args>;
  private lastSrcMods: number[];
  private disconnectors: Disconnector[];
  private order: Source<any>[];

  constructor(builder: TupleBuilder<Args>) {
    super({ ...builder, value: TUPLE_PLACEHOLDER as Args });
    this.sources = builder.sources;
    this.order = builder.sources.toSorted((l, r) => l.depends(r) ? -1 : 1);
    this.lastSrcMods = new Array<number>(builder.sources.length).fill(-1);
  }

  firstSubscribe(): void {
    this.actualize();
    this.disconnectors = iter(this.order)
      .enumerate()
      .map(([s, i]) => s.subscribe((v, mods) => this.actualize(true), this.lastSrcMods[i]))
      .collect();
  }

  private actualize(forse = false) {
    if (!forse && this.hasSubscriptions() && this.value !== TUPLE_PLACEHOLDER) return;
    this.modImmer(draft => {
      iter(this.sources).enumerate()
        .forEach(([src, i]) => {
          const lastSrcMods = this.lastSrcMods[i];
          const srcMods = src.mods()
          if (srcMods !== lastSrcMods) {
            draft[i] = src.get();
            this.lastSrcMods[i] = srcMods;
          }
        });
    });
  }

  set(newValue: Args): void {
    if (this.value === TUPLE_PLACEHOLDER) this.value = newValue;
    else super.set(newValue);
  }

  protected setOrDispose(newValue: Args): void {
    if (this.value === TUPLE_PLACEHOLDER) this.value = newValue;
    else super.setOrDispose(newValue);
  }

  get(): Args {
    this.actualize();
    return super.get();
  }

  mods(): number {
    this.actualize();
    return super.mods();
  }

  depends(value: any): boolean {
    return iter(this.sources).any(s => s === value || s.depends(value))
  }

  lastDisconnect(): void { this.disconnectors.forEach(d => d()) }
}

export function tuple<Args extends any[]>(...sources: SourcefyArray<Args>): Tuple<Args> {
  return new Tuple<Args>({ sources });
}

export const CONTAINERS = new Set<ValuesContainer>();
export function createContainer(name: string): ValuesContainer {
  const values = new ValuesContainer(name);
  CONTAINERS.add(values);
  values.addDisconnector(() => CONTAINERS.delete(values));
  return values;
}

function uniqueValues<Tuple extends any[]>(tuple: Tuple): boolean {
  const set = new Set(tuple);
  return tuple.length === set.size;
}

function exactContent(tuple1: any[], tuple2: any[]): boolean {
  if (tuple1.length !== tuple2.length) return false;
  return tuple1.every(x => tuple2.includes(x));
}

function exactContentAndOrder(tuple1: any[], tuple2: any[]): boolean {
  if (tuple1.length !== tuple2.length) return false;
  return tuple1.every((x, i) => tuple2[i] === x);
}

export class ValuesContainer implements Disposable {
  private graph = new DirectionalGraph<Disposable>();
  private tupleCache = new Map<Source<any>[], Source<any>>();
  private children = new Map<string, ValuesContainer>();

  constructor(readonly name: string) { }

  public tuple<Tuple extends any[]>(srcs: SourcefyArray<Tuple>): Source<SingleTuple<Tuple>> {
    if (!uniqueValues(srcs)) throw new Error(`Duplicate sources`);
    const cached = iter(this.tupleCache.entries())
      .filter(([k, _]) => exactContentAndOrder(k, srcs))
      .map(second)
      .first();
    if (cached.isPresent()) return cached.get();
    if (iter(this.tupleCache.keys()).any(t => exactContent(t, srcs)))
      throw new Error(`Tuple with different order already exist`);
    const result = srcs.length === 1 ? srcs[0] : tuple(...srcs);
    this.tupleCache.set(srcs, result);
    return result;
  }

  private find(value: any): Optional<Disposable> {
    return this.graph.nodes.has(value)
      ? Optional.of(value as Disposable)
      : Optional.empty();
  }

  size() { return this.graph.nodes.size }

  addDisconnector(disconnector: Disconnector): void {
    this.addDisposable({ dispose: async () => disconnector() });
  }

  addDisposable<T extends Disposable>(value: T): T {
    this.graph.addNode(value);
    return value;
  }

  createChild(name: string): ValuesContainer {
    const prevContainer = this.children.get(name);
    if (prevContainer !== undefined) prevContainer.dispose();
    const newContainer = createContainer(name)
    this.children.set(name, newContainer);
    return newContainer;
  }

  addSubscribed<T>(value: Source<T>, cb: ChangeCallback<T>): void {
    const dispose = disposable(value.subscribe(cb));
    this.find(value).ifPresentOrElse(d => this.graph.add(dispose, d), () => this.addDisposable(dispose));
  }

  const<T>(name: string, v: T, disposer?: Consumer<T>): Source<T> {
    return this.addDisposable(constSource(name, v, disposer));
  }

  value<T>(name: string, v: T): Value<T> {
    return this.addDisposable(value(name, v));
  }

  valueBuilder<T>(builder: ValueBuilder<T>): Value<T> {
    return this.addDisposable(valueBuilder(builder));
  }

  proxyBuilder<T>(builder: ProxyValueBuilder<T>): ProxyValue<T> {
    return this.addDisposable(proxyBuilder(builder));
  }

  proxyAsyncBuilder<T>(builder: ProxyValueAsyncBuilder<T>): ProxyValueAsync<T> {
    return this.addDisposable(proxyAsyncBuilder(builder));
  }


  transformedSelf<S, D>(name: string, source: Source<S>, init: D, transformer: BiFunction<S, D, D>, valueBuilder?: Omit<ValueBuilder<D>, 'value'>): TransformValue<[S], D> {
    const srcDisposable = this.find(source);
    const value = this.addDisposable(transformedBuilder<[S], D>({ name, source, transformer, ...valueBuilder, value: init }));
    srcDisposable.ifPresent(d => this.graph.add(value, d));
    return value;
  }

  transformed<S, D>(name: string, source: Source<S>, transformer: Function<S, D>, valueBuilder?: Omit<ValueBuilder<D>, 'value'>): TransformValue<[S], D> {
    return this.transformedSelf(name, source, TRANSFORM_PLACEHOLDER as D, transformer, valueBuilder);
  }

  fields<S, Keys extends keyof S>(name: string, source: Source<S>, ...fields: Keys[]): TransformValue<[S], Pick<S, Keys>> {
    const transformer = (s: S) => { const r: Pick<S, Keys> = {} as Pick<S, Keys>; fields.forEach(f => r[f] = s[f]); return r }
    return this.transformed(name, source, transformer, { eq: objectEq });
  }

  field<S, Key extends keyof S>(name: string, source: Source<S>, field: Key, valueBuilder?: Omit<ValueBuilder<S[Key]>, 'value'>): TransformValue<[S], S[Key]> {
    const transformer = (s: S) => s[field]
    return this.transformed(name, source, transformer, valueBuilder);
  }

  transformedSelfTuple<S extends any[], D>(name: string, srcs: SourcefyArray<S>, init: D, transformer: BiFunction<S, D, D>, valueBuilder?: Omit<ValueBuilder<D>, 'value'>): TransformValue<S, D> {
    const source = this.tuple(srcs);
    const srcDisposables = srcs.map(s => this.find(s));
    const value = this.addDisposable(transformedBuilder({ name, source, transformer, ...valueBuilder, value: init }));
    srcDisposables.forEach(d => d.ifPresent(d => this.graph.add(value, d)));
    return value;
  }

  transformedTuple<S extends any[], D>(name: string, srcs: SourcefyArray<S>, transformer: Function<S, D>, valueBuilder?: Omit<ValueBuilder<D>, 'value'>): TransformValue<S, D> {
    return this.transformedSelfTuple(name, srcs, TRANSFORM_PLACEHOLDER as D, transformer, valueBuilder);
  }


  transformedAsyncBuilder<S, D>(builder: TransformValueAsyncBuilder<[S], D>): TransformValueAsync<[S], D> {
    const srcDisposable = this.find(builder.source);
    const value = this.addDisposable(transformedAsyncBuilder(builder));
    srcDisposable.ifPresent(d => this.graph.add(value, d));
    return value;
  }

  async transformedAsyncTuple<S extends any[], D>(
    name: string,
    srcs: SourcefyArray<S>,
    transformer: Function<S, Promise<D>>,
    disposer?: Consumer<D>,
    srcConnector: BiFunction<S, BaseValue<D>, Disconnector> = _ => nil()
  ): Promise<TransformValueAsync<S, D>> {
    const source = this.tuple(srcs);
    const srcDisposables = srcs.map(s => this.find(s));
    const initialValue = { value: await transformer(source.get()), mods: source.mods() };
    const result = this.addDisposable(transformedAsyncBuilder({ name, source, transformer, initialValue, disposer, srcConnector }));
    srcDisposables.forEach(d => d.ifPresent(d => this.graph.add(result, d)));
    return result;
  }

  async transformedAsync<S, D>(
    name: string,
    source: Source<S>,
    transformer: Function<S, Promise<D>>,
    disposer?: Consumer<D>,
    srcConnector: BiFunction<S, BaseValue<D>, Disconnector> = _ => nil()
  ): Promise<TransformValueAsync<[S], D>> {
    const srcDisposable = this.find(source);
    const initialValue = { value: await transformer(source.get()), mods: source.mods() };
    const result = this.addDisposable(transformedAsyncBuilder<[S], D>({ name, source, transformer, initialValue, disposer, srcConnector }));
    srcDisposable.ifPresent(d => this.graph.add(result, d));
    return result;
  }

  handle<Srcs extends any[]>(srcs: SourcefyArray<Srcs>, handler: Consumer<SingleTuple<Srcs>>): Disconnector {
    const value = this.tuple(srcs);
    handler(value.get());
    return value.subscribe(handler);
  }

  handleStandalone<Srcs extends any[]>(srcs: SourcefyArray<Srcs>, handler: Consumer<SingleTuple<Srcs>>): void {
    const dispose = disposable(this.handle(srcs, handler));
    srcs.map(s => this.find(s)).forEach(d => d.ifPresentOrElse(d => this.graph.add(dispose, d), () => this.addDisposable(dispose)));
  }

  signal<Args extends any[]>(): Signal<Args> {
    const handlers = new Set<Consumer<Args>>();
    const subscribe = (handler: Consumer<Args>) => { handlers.add(handler); return () => handlers.delete(handler) }
    const call = (...args: Args) => handlers.forEach(h => h(args));

    this.addDisconnector(() => { if (handlers.size !== 0) throw new Error('Signal has subscriptions') })
    return { subscribe, call }
  }

  initialize<T>(init: Function<ValuesContainer, T>): T {
    return result(() => init(this)).onErr(_ => this.dispose()).unwrap()
  }

  async initializeAsync<T>(init: Function<ValuesContainer, Promise<T>>): Promise<T> {
    return resultAsync(() => init(this)).then(r => r.onErr(_ => this.dispose()).unwrap())
  }

  async dispose(): Promise<void> {
    const { promise, reject, resolve } = Promise.withResolvers<void>();
    setTimeout(async () => {
      const result = await resultAsync(async () => {
        await iter(this.children.values()).forEach(c => c.dispose()).await_();
        await iter(this.graph.orderedAll()).forEach(d => d.dispose()).await_();
        this.graph.nodes.clear();
        this.tupleCache.clear();
      });
      result
        .onOk(resolve)
        .onErr(reject)
    });
    return promise;
  }
}