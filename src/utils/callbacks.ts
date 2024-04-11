import Optional from "optional-js";
import { Consumer, Function, Supplier, nil } from "./types";

export type ChangeCallback<T> = Consumer<T>;
export type Disconnector = Consumer<void>

export interface CallbackChannel<T> {
  add(cb: ChangeCallback<T>): Disconnector;
}

export interface CallbackHandler<T> {
  connect(channel: CallbackChannel<T>): void;
}

export class CallbackHandlerImpl<T> implements CallbackHandler<T> {
  private disconnector: Disconnector = null;

  constructor(private callback: ChangeCallback<T>) { }

  connect(src: Source<T>): void {
    this.disconnector?.();
    this.disconnector = src.add(this.callback);
    this.callback(src.get());
  }
}

export interface Source<T> extends CallbackChannel<T> { get(): T }
export interface Destenation<T> { set(value: T): void }


export class CallbackChannelImpl<T> implements CallbackChannel<T> {
  private handlers = new Set<ChangeCallback<T>>();

  add(cb: ChangeCallback<T>): Disconnector {
    this.handlers.add(cb);
    return () => this.handlers.delete(cb);
  }

  notify(value: T): void { for (const h of this.handlers) h(value) }
}

export class CallbackChannelStub<T> implements CallbackChannel<T> {
  add(_: ChangeCallback<T>): Disconnector { return nil() }
}

export class Value<T> extends CallbackChannelImpl<T> implements Destenation<T>, Source<T> {
  constructor(private value: T) { super() }
  get(): T { return this.value }
  set(newValue: T) { if (this.value != newValue) { this.value = newValue; this.notify(newValue) } }
}

export function value<T>(value: T): Value<T> {
  return new Value<T>(value);
}

export class Reference<T> extends CallbackChannelImpl<T> implements Source<T> {
  constructor(private value: T) { super() }
  get(): T { return this.value }
  nodify(): void { this.notify(this.value) }
}

export function reference<T>(ref: T): Reference<T> {
  return new Reference<T>(ref);
}

export class TransformValue<S, D> extends CallbackChannelImpl<D> implements Source<D> {
  private value: D;
  private initialized: boolean;

  constructor(private source: Source<S>, private transformer: Function<S, D>) {
    super();
    source.add(v => {
      this.initialized = true;
      const nvalue = this.transformer(v);
      if (nvalue != this.value) {
        this.value = nvalue;
        this.notify(this.value)
      }
    });
  }
  get(): D { if (!this.initialized) { this.value = this.transformer(this.source.get()); this.initialized = true } return this.value }
}
export function transformed<S, D>(source: Source<S>, transformer: Function<S, D>): TransformValue<S, D> {
  return new TransformValue<S, D>(source, transformer);
}

export class TransformValueAsync<S, D> extends CallbackChannelImpl<D> implements Source<D> {
  constructor(
    private source: Source<S>,
    private transformer: Function<S, Promise<D>>,
    private value: D
  ) {
    super();
    source.add(async v => {
      const nvalue = await this.transformer(v)
      if (nvalue != this.value) {
        this.value = nvalue;
        this.notify(this.value)
      }
    });
  }

  get(): D { return this.value }
}

export async function transformedAsync<S, D>(source: Source<S>, init: Promise<D>, transformer: Function<S, Promise<D>>): Promise<TransformValueAsync<S, D>> {
  return new TransformValueAsync<S, D>(source, transformer, await init);
}

export function transformedAsyncImmediate<S, D>(source: Source<S>, init: D, transformer: Function<S, Promise<D>>): TransformValueAsync<S, D> {
  return new TransformValueAsync<S, D>(source, transformer, init);
}

type SourceCallbacklChannelfy<T> = { [P in keyof T]: Source<T[P]> };
export class Tuple<Args extends any[]> extends CallbackChannelImpl<Args> implements Source<Args> {
  sources: SourceCallbacklChannelfy<Args>[number][];
  constructor(...sources: SourceCallbacklChannelfy<Args>) {
    super();
    this.sources = [...sources];
    this.sources.forEach(s => s.add(_ => this.notify(this.get())));
  }

  get(): Args { return <Args>this.sources.map(v => v.get()) }
}

export function tuple<Args extends any[]>(...sources: SourceCallbacklChannelfy<Args>): Tuple<Args> {
  return new Tuple<Args>(...sources);
}

export type Handler<Args extends any[]> = (parent: CallbackChannel<void>, ...args: Args) => void;
export type Handle = { update: () => void, stop: () => void };

export function handle<Args extends any[]>(parent: CallbackChannel<void> | null, handler: Handler<Args>, ...values: SourceCallbacklChannelfy<Args>): Handle {
  const channel = reference<void>(null);
  const update = () => {
    const vs = <Args>values.map(v => v.get());
    channel.notify();
    handler(channel, ...vs);
  }
  const handles = values.map(v => v.add(update));
  const stop = () => handles.forEach(h => h());
  if (parent != null) parent.add(stop);
  update();
  return { update, stop }
}