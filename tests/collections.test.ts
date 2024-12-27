import { Deck, IndexedDeck, all, cyclicPairs, cyclicRange, enumerate, findFirst, first, flatten, isEmpty, last, map, slidingPairs, range, rect, reduce, reversed, sub, take, wrap, slidingWindow, groups, Ring } from "../src/utils/collections";
import { SortedList } from "../src/utils/list";
import { rand0 } from "../src/utils/random";


test('Deck', () => {
  const deck = new Deck<number>();
  expect(deck.length()).toBe(0);
  expect(isEmpty(deck)).toBe(true);

  deck.push(1);
  expect(deck.get(0)).toBe(1);
  expect(deck.length()).toBe(1);
  expect(isEmpty(deck)).toBe(false);
  expect(deck.get(1)).toBe(undefined);
  expect(deck.top()).toBe(1);

  deck.pop();
  expect(deck.length()).toBe(0);
  expect(isEmpty(deck)).toBe(true);
  expect(deck.get(0)).toBe(1);
  expect(deck.top()).toBe(undefined);

  deck.pushAll([1, 2, 3]);
  expect(deck.length()).toBe(3);
  expect(isEmpty(deck)).toBe(false);
  expect(deck.get(0)).toBe(1);
  expect(deck.get(1)).toBe(2);
  expect(deck.get(2)).toBe(3);
  expect(deck.top()).toBe(3);

  deck.clear();
  expect(deck.length()).toBe(0);
  expect(isEmpty(deck)).toBe(true);
  expect(deck.get(0)).toBe(1);
  expect(deck.top()).toBe(undefined);

  expect(() => deck.set(0, 3)).toThrow();
  expect(() => deck.set(-1, 3)).toThrow();

  deck.pushAll([1, 2, 3]);
  const deck1 = deck.clone();
  deck.set(0, 3);
  expect(deck.get(0)).toBe(3);
  expect(deck1.get(0)).toBe(1);
  expect([...deck]).toStrictEqual([3, 2, 3]);
  expect([...deck1]).toStrictEqual([1, 2, 3]);
});

test('Ring', () => {
  const ring1 = new Ring<number>(10);

  expect(ring1.length()).toBe(0);

  ring1.push(1);
  ring1.pushHead(-1);
  expect(ring1.length()).toBe(2);
  expect(ring1.get(0)).toBe(-1);
  expect(ring1.get(1)).toBe(1);

  ring1.pushHead(2);
  ring1.pushHead(3);
  ring1.pushHead(4);
  ring1.pushHead(5);
  ring1.pushHead(6);
  ring1.pushHead(7);
  ring1.pushHead(8);
  ring1.pushHead(9);
  expect(ring1.length()).toBe(10);
  expect([...ring1]).toStrictEqual([9, 8, 7, 6, 5, 4, 3, 2, -1, 1]);

  expect(() => ring1.push(1)).toThrow();

  ring1.pop();
  ring1.pop();
  ring1.popHead();
  ring1.popHead();
  expect([...ring1]).toStrictEqual([7, 6, 5, 4, 3, 2]);
})

test('IndexedDeck', () => {
  const deck = new IndexedDeck<number>();

  deck.push(42);
  expect(deck.indexOf(42)).toBe(0);
  expect(deck.indexOf(11)).toBe(-1);

  deck.set(0, 12);
  expect(deck.indexOf(42)).toBe(-1);
  expect(deck.indexOf(12)).toBe(0);

  deck.clear();
  expect(deck.indexOf(42)).toBe(-1);
  expect(deck.indexOf(12)).toBe(-1);
  expect(() => deck.set(1, 12)).toThrow();

  deck.pushAll([7, 42, 101]);
  expect(deck.hasAny([1, 2, 3])).toBe(false);
  expect(deck.hasAny([7, 2, 3])).toBe(true);
  expect(deck.hasAny([2, 3, 101])).toBe(true);
  expect(deck.hasAny([])).toBe(false);
  expect(first(deck)).toBe(7);
  expect(last(deck)).toBe(101);

  deck.pushAll([42, 42, 42]);
  expect(deck.length()).toBe(3);
  expect(deck.indexOf(42)).toBe(1);
  expect([...deck]).toStrictEqual([7, 42, 101]);

  deck.set(0, 42);
  expect(deck.indexOf(42)).toBe(0);
});

test('Utils', () => {
  expect([...map([1, 2, 3, 4], x => x * x)]).toStrictEqual([1, 4, 9, 16]);
  expect([...map([], x => x * x)]).toStrictEqual([]);
  expect(all([0, 0, 0], x => x === 0)).toBe(true);
  expect(all([0, 0, 1], x => x === 0)).toBe(false);
  expect(all([], x => x === 0)).toBe(true);
  expect(reduce([1, 2, 3], (r, h) => r * h, 1)).toBe(6);
  expect(reduce([], (r: number, h: number) => r * h, 1)).toBe(1);
  expect([...sub(wrap([1, 2, 3]), 1, 1)]).toStrictEqual([2]);
  expect([...reversed(wrap([1, 2, 3]))]).toStrictEqual([3, 2, 1]);
  expect([...reversed(wrap([]))]).toStrictEqual([]);
  expect([...enumerate(['foo', 'bar', 'baz'])]).toStrictEqual([['foo', 0], ['bar', 1], ['baz', 2]]);
  expect([...enumerate([])]).toStrictEqual([]);
  expect([...range(1, 3)]).toStrictEqual([1, 2]);
  expect([...range(1, 1)]).toStrictEqual([]);
  expect([...take([1, 2, 3, 4], 1)]).toStrictEqual([1]);
  expect([...range(3, 1)]).toStrictEqual([3, 2]);
  expect([...cyclicRange(1, 3)]).toStrictEqual([1, 2, 0]);
  expect(() => [...cyclicRange(3, 1)]).toThrow();
  expect([...cyclicPairs(3)]).toStrictEqual([[0, 1], [1, 2], [2, 0]]);
  expect(() => [...cyclicPairs(-3)]).toThrow();
  expect([...cyclicPairs(0)]).toStrictEqual([]);
  expect([...slidingPairs([1, 2, 3, 4])]).toStrictEqual([[1, 2], [2, 3], [3, 4]]);
  expect([...slidingPairs([1])]).toStrictEqual([]);
  expect([...slidingWindow([1, 2, 3, 4], 3)]).toStrictEqual([[1, 2, 3], [2, 3, 4]]);
  expect([...groups([1, 2, 3, 4], 2)]).toStrictEqual([[1, 2], [3, 4]]);
  expect(() => [...groups([1, 2, 3, 4], 3)]).toThrow();
  expect([...rect(1, 1)]).toStrictEqual([[0, 0]]);
  expect([...rect(2, 2)]).toStrictEqual([[0, 0], [1, 0], [0, 1], [1, 1]]);
  expect(() => [...rect(-2, 2)]).toThrow();
  expect([...flatten([[1, 2, 3], [4], [], [5, [6, 7]]])]).toStrictEqual([1, 2, 3, 4, 5, [6, 7]]);
  expect(findFirst([1, 2, 3, 4]).get()).toBe(1);
  expect(findFirst([]).isPresent()).toBe(false);
  expect(findFirst([1, 2, 3], x => x === 42).isPresent()).toBe(false);
  expect(findFirst([1, 2, 3], x => x === 3).get()).toBe(3);
});

test('Sorted List', () => {
  type T = { i: number, n: number }
  const list = new SortedList<T>();
  const items: T[] = [];
  for (let i = 0; i < 200; i++) {
    const t: T = { i, n: rand0(1) };
    items.push(t);
    list.add(t, t.n);
  }
  items.sort((l, r) => l.n - r.n);
  expect([...list.get()]).toStrictEqual(items);

  const list1 = new SortedList<string>();
  list1.add('a', 1);
  list1.add('b', 1);
  list1.add('c', 1);
  list1.add('d', 1);
  expect([...list1.get()]).toStrictEqual(['a', 'b', 'c', 'd']);

  list1.clear();
  list1.add('a', 1);
  list1.add('b', 0.5);
  list1.add('c', 0.5);
  list1.add('d', 0.5);
  list1.add('e', 0.5);
  list1.add('f', 0.5);
  expect([...list1.get()]).toStrictEqual(['b', 'c', 'd', 'e', 'f', 'a']);
});
