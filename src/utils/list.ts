import { TERMINAL_ITERATOR_RESULT, EMPTY_ITERATOR, Deck } from "./collections";

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

  constructor() { this.clear() }

  public insertAfter(value: T, after: number = this.lastIdx.get(0)): number {
    const idx = this.elements.length();
    const next = this.nextIdx.get(after);
    this.elements.push(value);
    this.nextIdx.push(next)
    this.lastIdx.push(after);
    this.nextIdx.set(after, idx);
    this.lastIdx.set(next, idx);
    return idx;
  }

  public insertBefore(value: T, before: number = this.nextIdx.get(0)): number {
    const idx = this.elements.length();
    const last = this.lastIdx.get(before);
    this.elements.push(value);
    this.nextIdx.push(before)
    this.lastIdx.push(last);
    this.nextIdx.set(last, idx);
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

  public pop() {
    const lastId = this.last(0);
    const last = this.get(lastId);
    this.remove(lastId);
    return last;
  }

  public get(idx: number): T { return this.elements.get(idx) }
  public next(idx: number): number { return this.nextIdx.get(idx) }
  public last(idx: number): number { return this.lastIdx.get(idx) }
  public push(value: T): number { return this.insertAfter(value) }
  public first() { return this.next(0) }

  public clear() {
    this.elements.clear().push(null);
    this.nextIdx.clear().push(0);
    this.lastIdx.clear().push(0);
  }

  public [Symbol.iterator]() {
    let pointer = this.first();
    return pointer == 0
      ? EMPTY_ITERATOR
      : {
        next: () => {
          if (pointer == 0) return TERMINAL_ITERATOR_RESULT;
          else {
            const obj = this.get(pointer);
            pointer = this.next(pointer);
            return { done: false, value: obj }
          }
        }
      }
  }
}

function advance(iter: number, list: FastList<any>, steps: number) {
  for (let i = 0; i < steps; i++) iter = list.next(iter)
  return iter;
}

function length(list: FastList<any>, from: number, to: number) {
  let length = 0;
  for (let i = from; i != to; i = list.next(i)) length++;
  return length;
}

function binaryIndexOf(list: FastList<number>, searchElement: number) {
  let refMin = list.first();
  let min = list.first();
  let max = list.last(0);
  if (searchElement < list.get(min)) return 0;
  if (searchElement >= list.get(max)) return max;
  let current = min;
  let currentElement: number = null;
  let size = length(list, min, max);
  while (size > 0) {
    size -= size / 2 | 0;
    current = advance(min, list, size);
    currentElement = list.get(current);
    if (currentElement < searchElement) min = list.next(current);
    else if (currentElement > searchElement) max = list.last(current);
    else break;
    size--;
  }
  return current == refMin ? refMin : current;
}

export class SortedHeap<T> {
  private values = new FastList<T>();
  private sortValues = new FastList<number>();

  public add(value: T, sortValue: number) {
    const ptr = binaryIndexOf(this.sortValues, sortValue);
    this.values.insertAfter(value, ptr);
    this.sortValues.insertAfter(sortValue, ptr);
  }

  public clear() {
    this.values.clear();
    this.sortValues.clear();
  }

  public get(): Iterable<T> { return this.values }
}