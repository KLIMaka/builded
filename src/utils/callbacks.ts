import { FastList } from "../utils/list"

export type Callback<Args extends any[]> = (...args: Args) => void;
export type CallbackHandle = { disconnect: () => void }

export interface CallbackChannel<Args extends any[]> {
  add(cb: Callback<Args>): CallbackHandle;
}

export interface CallbackHandler<Args extends any[]> {
  connect(channel: CallbackChannel<Args>): void;
}

export class CallbackHandlerImpl<Args extends any[]> implements CallbackHandler<Args>{
  private handle: CallbackHandle = null;

  constructor(private callback: Callback<Args>) { }

  connect(channel: CallbackChannel<Args>): void {
    if (this.handle != null) this.handle.disconnect();
    this.handle = channel.add(this.callback);
  }
}

export interface Source<T> { get(): T }
export interface Destenation<T> { set(value: T): void }

export class CallbackChannelImpl<Args extends any[]> implements CallbackChannel<Args> {
  private handlers = new FastList<Callback<Args>>();

  add(cb: Callback<Args>): CallbackHandle {
    const handle = this.handlers.push(cb);
    return { disconnect: () => this.handlers.remove(handle) };
  }

  notify(...args: Args): void { for (const h of this.handlers) h(...args) }
}

export class CallbackChannelStub<Args extends any[]> implements CallbackChannel<Args> {
  readonly handle: CallbackHandle = { disconnect: () => { } };
  add(cb: Callback<Args>): CallbackHandle { return this.handle }
}

export interface SourceCallbacklChannel<T> extends Source<T>, CallbackChannel<[]> { };

export class Value<T> extends CallbackChannelImpl<[]> implements Destenation<T>, Source<T> {
  constructor(private value: T) { super() }
  get(): T { return this.value }
  set(newValue: T) { this.value = newValue; this.notify(); }
}

export function value<T>(value: T): Value<T> {
  return new Value<T>(value);
}

export class TransformValue<T, U> extends CallbackChannelImpl<[]> implements Source<T> {
  private needToUpdate = true;
  private value: T;

  constructor(private source: SourceCallbacklChannel<U>, private transformer: (value: U) => T) {
    super();
    source.add(() => { this.needToUpdate = true; this.notify() });
  }

  private update() { this.value = this.transformer(this.source.get()); }
  get(): T { if (this.needToUpdate) { this.update(); this.needToUpdate = false } return this.value }
}

export function transformed<T, U>(source: SourceCallbacklChannel<U>, transformer: (value: U) => T): TransformValue<T, U> {
  return new TransformValue<T, U>(source, transformer);
}

export class Delay<T> extends CallbackChannelImpl<[]> implements Source<T> {
  private handle = -1;
  constructor(private source: SourceCallbacklChannel<T>, delay = 0) {
    super();
    source.add(() => {
      if (this.handle != -1) return;
      this.handle = window.setTimeout(() => { this.handle = -1; this.notify() }, delay);
    });
  }

  get(): T { return this.source.get() }
}

export function delay<T>(source: SourceCallbacklChannel<T>, delay = 0) {
  return new Delay<T>(source, delay);
}

export class Tuple<Args extends any[]> extends CallbackChannelImpl<[]> implements Source<Args> {
  sources: SourceCallbacklChannelfy<Args>[number][];
  constructor(...sources: SourceCallbacklChannelfy<Args>) {
    super();
    this.sources = [...sources];
    this.sources.forEach(s => { s.add(() => this.notify()) });
  }

  get(): Args { return <Args>this.sources.map(v => v.get()) }
}

export function tuple<Args extends any[]>(...sources: SourceCallbacklChannelfy<Args>): Tuple<Args> {
  return new Tuple<Args>(...sources);
}

export type Handler<Args extends any[]> = (parent: CallbackChannel<[]>, ...args: Args) => void;
type SourceCallbacklChannelfy<T> = { [P in keyof T]: SourceCallbacklChannel<T[P]> };

export type Handle = { update: () => void, stop: () => void };
export function handle<Args extends any[]>(parent: CallbackChannel<[]>, handler: Handler<Args>, ...values: SourceCallbacklChannelfy<Args>): Handle {
  const channel = new CallbackChannelImpl<[]>();
  const update = () => {
    const vs = values.map(v => v.get());
    channel.notify();
    handler(channel, ...<Args>vs);
  }
  const handles = values.map(v => v.add(update));
  const stop = () => handles.forEach(h => h.disconnect());
  if (parent != null) parent.add(stop);
  update();
  return { update, stop }
}