import { EMPTY_ITERATOR, ITERATOR_RESULT, TERMINAL_ITERATOR_RESULT, map } from "./collections";

export class Node<T> {
  constructor(
    public obj: T = null,
    public next: Node<T> = null,
    public prev: Node<T> = null) {
  }
}

export class List<T> implements Iterable<T> {
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
    const ret = this.last().obj;
    this.remove(this.last());
    return ret;
  }

  public push(value: T): Node<T> {
    return this.insertAfter(value);
  }

  public pushForward(value: T): Node<T> {
    return this.insertBefore(value);
  }

  public pushAll(values: T[]): Node<T>[] {
    const nodes = [];
    for (let i = 0; i < values.length; i++)
      nodes.push(this.insertAfter(values[i]));
    return nodes;
  }

  public isEmpty(): boolean {
    return this.nil.next === this.nil;
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
    if (ref === this.nil) return;
    ref.next.prev = ref.prev;
    ref.prev.next = ref.next;
    return ref;
  }

  public clear() {
    this.nil.next = this.nil;
    this.nil.prev = this.nil;
  }

  public [Symbol.iterator](): Iterator<T> {
    let pointer = this.first();
    return pointer === this.terminator()
      ? EMPTY_ITERATOR
      : {
        next: () => {
          if (pointer === this.terminator())
            return TERMINAL_ITERATOR_RESULT;
          else {
            const obj = pointer.obj;
            pointer = pointer.next;
            return ITERATOR_RESULT(obj);
          }
        }
      }
  }
}

export class FastList<T> implements Iterable<T> {
  private elements: any[] = [];

  constructor() {
    this.clear();
  }

  private static nextOff(idx: number) { return idx * 3 + 1 }
  private static lastOff(idx: number) { return idx * 3 + 2 }

  insertAfter(value: T, after: number = this.elements[1]): number {
    const idx = this.length() + 1;
    const next = this.next(after);
    this.elements.push(value, next, after);
    this.elements[FastList.nextOff(after)] = idx;
    this.elements[FastList.lastOff(next)] = idx;
    return idx;
  }

  insertBefore(value: T, before: number = this.elements[2]): number {
    const idx = this.length() + 1;
    const last = this.last(before);
    this.elements.push(value, before, last);
    this.elements[FastList.nextOff(last)] = idx;
    this.elements[FastList.lastOff(before)] = idx;
    return idx;
  }

  remove(idx: number): T {
    if (idx <= 0 || idx >= this.length() || this.next(idx) === -1) return null;
    this.elements[FastList.nextOff(this.last(idx))] = this.next(idx);
    this.elements[FastList.lastOff(this.next(idx))] = this.last(idx);
    this.elements[FastList.nextOff(idx)] = -1;
    this.elements[FastList.lastOff(idx)] = -1;
    const elem = this.elements[idx * 3];
    this.elements[idx * 3] = null;
    return elem;
  }

  clear() { this.elements = [null, 0, 0] }
  length(): number { return this.elements.length / 3 - 1 }
  get(idx: number): T { return this.elements[idx * 3] as T }
  next(idx: number): number { return this.elements[FastList.nextOff(idx)] as number }
  last(idx: number): number { return this.elements[FastList.lastOff(idx)] as number }
  push(value: T): number { return this.insertAfter(value) }
  pop() { return this.remove(this.last(0)) }
  first() { return this.next(0) }
  isEmpty() { return this.length() === 0 }

  public [Symbol.iterator](): Iterator<T> {
    let ptr = this.first();
    return ptr === 0
      ? EMPTY_ITERATOR
      : {
        next: () => {
          if (ptr === 0) return TERMINAL_ITERATOR_RESULT;
          else {
            const obj = this.get(ptr);
            ptr = this.next(ptr);
            return ITERATOR_RESULT(obj);
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
  for (let i = from; i !== to; i = list.next(i)) length++;
  return length;
}

export class SortedList<T> implements Iterable<T> {
  private values = new FastList<[T, number]>();

  add(value: T, sortValue: number) {
    const ptr = this.binaryIndexOf(sortValue);
    this.values.insertAfter([value, sortValue], ptr);
  }

  clear() {
    this.values.clear();
  }

  get(): Iterable<T> { return map(this.values, v => v[0]) }
  isEmpty(): boolean { return this.values.isEmpty() }
  first(): T { return this.values.get(this.values.first())[0] }

  private binaryIndexOf(searchElement: number) {
    const values = this.values;
    if (values.isEmpty()) return 0;
    let min = values.first();
    let max = values.last(0);
    if (searchElement < values.get(min)[1]) return 0;
    if (searchElement >= values.get(max)[1]) return max;
    let size = length(values, min, max);
    while (min !== max) {
      const ds = Math.ceil(size / 2);
      size -= ds;
      const current = advance(min, values, ds);
      const currentElement = values.get(current)[1];
      if (currentElement <= searchElement) min = current;
      else max = values.last(current);
    }
    return min;
  }

  public [Symbol.iterator](): Iterator<T> {
    const iter = this.values[Symbol.iterator]();
    return {
      next: () => {
        const v = iter.next();
        return v.done ? TERMINAL_ITERATOR_RESULT : ITERATOR_RESULT(v.value[0]);
      }
    }
  }
}