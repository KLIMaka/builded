import { TERMINAL_ITERATOR_RESULT, EMPTY_ITERATOR, Deck } from "../modules/collections";

export class Node<T> {
  constructor(
    public obj: T = null,
    public next: Node<T> = null,
    public prev: Node<T> = null) {
  }
}

export class List<T> implements Iterable<T>{
  private nil = new Node<T>();

  constructor() {
    this.clear();
  }

  public first(): Node<T> {
    return this.nil.next;
  }

  public last(): Node<T> {
    return this.nil.prev;
  }

  public terminator(): Node<T> {
    return this.nil;
  }

  public pop(): T {
    let ret = this.last().obj;
    this.remove(this.last());
    return ret;
  }

  public push(value: T): Node<T> {
    return this.insertAfter(value);
  }

  public pushAll(values: T[]): Node<T>[] {
    let nodes = [];
    for (let i = 0; i < values.length; i++)
      nodes.push(this.insertAfter(values[i]));
    return nodes;
  }

  public isEmpty(): boolean {
    return this.nil.next == this.nil;
  }

  public insertNodeBefore(node: Node<T>, ref: Node<T> = this.nil.next): Node<T> {
    node.next = ref;
    node.prev = ref.prev;
    node.prev.next = node;
    ref.prev = node;
    return node;
  }

  public insertBefore(val: T, ref: Node<T> = this.nil.next): Node<T> {
    return this.insertNodeBefore(new Node<T>(val), ref);
  }

  public insertNodeAfter(node: Node<T>, ref: Node<T> = this.nil.prev): Node<T> {
    node.next = ref.next;
    node.next.prev = node;
    ref.next = node;
    node.prev = ref;
    return node;
  }

  public insertAfter(val: T, ref: Node<T> = this.nil.prev): Node<T> {
    return this.insertNodeAfter(new Node<T>(val), ref);
  }

  public remove(ref: Node<T>): Node<T> {
    if (ref == this.nil)
      return;

    ref.next.prev = ref.prev;
    ref.prev.next = ref.next;
    return ref;
  }

  public clear() {
    this.nil.next = this.nil;
    this.nil.prev = this.nil;
  }

  public [Symbol.iterator]() {
    let pointer = this.first();
    return pointer == this.terminator()
      ? EMPTY_ITERATOR
      : {
        next: () => {
          if (pointer == this.terminator())
            return <IteratorResult<T>>TERMINAL_ITERATOR_RESULT;
          else {
            let obj = pointer.obj;
            pointer = pointer.next;
            return <IteratorResult<T>>{ done: false, value: obj }
          }
        }
      }
  }
}

export class FastList<T> implements Iterable<T> {

  private elements = new Deck<T>();
  private nextIdx = new Deck<number>();
  private lastIdx = new Deck<number>();

  constructor() {
    this.clear();
  }

  public insertAfter(value: T, after: number = this.lastIdx.get(0)): number {
    const idx = this.elements.length();
    this.elements.push(value);
    this.nextIdx.push(0)
    this.lastIdx.push(after);
    this.nextIdx.set(after, idx);
    this.lastIdx.set(0, idx);
    return idx;
  }

  public insertBefore(value: T, before: number = this.nextIdx.get(0)): number {
    const idx = this.elements.length();
    this.elements.push(value);
    this.nextIdx.push(before)
    this.lastIdx.push(0);
    this.nextIdx.set(0, idx);
    this.lastIdx.set(before, idx);
    return idx;
  }

  public remove(idx: number): T {
    if (idx <= 0 || idx >= this.elements.length() - 1 || this.nextIdx.get(idx) == -1) return null;
    this.nextIdx.set(this.lastIdx.get(idx), this.nextIdx.get(idx));
    this.lastIdx.set(this.nextIdx.get(idx), this.lastIdx.get(idx));
    this.nextIdx.set(idx, -1);
    return this.elements.get(idx);
  }

  public get(idx: number): T {
    return this.elements.get(idx);
  }

  public next(idx: number): number {
    return this.nextIdx.get(idx);
  }

  public last(idx: number): number {
    return this.lastIdx.get(idx);
  }

  public push(value: T) {
    this.insertAfter(value)
  }

  public clear() {
    this.elements.clear().push(null);
    this.nextIdx.clear().push(0);
    this.lastIdx.clear().push(0);
  }

  public [Symbol.iterator]() {
    let pointer = this.next(0);
    return pointer == 0
      ? EMPTY_ITERATOR
      : {
        next: () => {
          if (pointer == 0) return TERMINAL_ITERATOR_RESULT;
          else {
            let obj = this.get(pointer);
            pointer = this.next(pointer);
            return { done: false, value: obj }
          }
        }
      }
  }
} 
