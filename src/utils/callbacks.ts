import { FastList } from "../utils/list"

export type Callback<Args extends any[]> = (...args: Args) => void;

export interface Callbacks<Args extends any[], H> {
  add(cb: Callback<Args>): H;
  remove(handle: H): void;
  notify(...args: Args): void;
}

export class SimpleCallbacksImpl implements Callbacks<[], number> {
  private handlers = new FastList<Callback<[]>>();

  add(cb: Callback<[]>): number { return this.handlers.push(cb) }
  remove(handle: number): void { this.handlers.remove(handle) }
  notify(): void { for (const h of this.handlers) h() }
}

export class SimpleCallbacksStub<T> implements Callbacks<[], number> {
  add(cb: Callback<[]>): number { return 0 }
  remove(handle: number): void { }
  notify(): void { }
}

export class ValueSetterCallbacksImpl<T> implements Callbacks<[T, T], number> {
  private handlers = new FastList<Callback<[T, T]>>();

  add(cb: Callback<[T, T]>): number { return this.handlers.push(cb) }
  remove(handle: number): void { this.handlers.remove(handle) }
  notify(o: T, n: T): void { for (const h of this.handlers) h(o, n) }
}