import { Deck, IndexedDeck, first, last, map, reduce, sub, wrap, reversed, enumerate, range, cyclicRange, cyclicPairs, rect, all, take } from "../src/utils/collections";


test('Deck', () => {
  const deck = new Deck<number>();
  expect(deck.length()).toBe(0);
  expect(deck.isEmpty()).toBe(true);

  deck.push(1);
  expect(deck.get(0)).toBe(1);
  expect(deck.length()).toBe(1);
  expect(deck.isEmpty()).toBe(false);
  expect(deck.get(1)).toBe(undefined);
  expect(deck.top()).toBe(1);

  deck.pop();
  expect(deck.length()).toBe(0);
  expect(deck.isEmpty()).toBe(true);
  expect(deck.get(0)).toBe(1);
  expect(deck.top()).toBe(undefined);

  deck.pushAll([1, 2, 3]);
  expect(deck.length()).toBe(3);
  expect(deck.isEmpty()).toBe(false);
  expect(deck.get(0)).toBe(1);
  expect(deck.get(1)).toBe(2);
  expect(deck.get(2)).toBe(3);
  expect(deck.top()).toBe(3);

  deck.clear();
  expect(deck.length()).toBe(0);
  expect(deck.isEmpty()).toBe(true);
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
  expect(all([0, 0, 0], x => x == 0)).toBe(true);
  expect(all([0, 0, 1], x => x == 0)).toBe(false);
  expect(all([], x => x == 0)).toBe(true);
  expect(reduce([1, 2, 3], (r, h) => r * h, 1)).toBe(6);
  expect(reduce([], (r: number, h: number) => r * h, 1)).toBe(1);
  expect([...sub(wrap([1, 2, 3]), 1, 1)]).toStrictEqual([2]);
  expect([...reversed(wrap([1, 2, 3]))]).toStrictEqual([3, 2, 1]);
  expect([...reversed(wrap([]))]).toStrictEqual([]);
  expect([...enumerate(['foo', 'bar', 'baz'])]).toStrictEqual([['foo', 0], ['bar', 1], ['baz', 2]]);
  expect([...enumerate([])]).toStrictEqual([]);
  expect([...range(1, 3)]).toStrictEqual([1, 2, 3]);
  expect([...range(1, 1)]).toStrictEqual([1]);
  expect([...take([1, 2, 3, 4], 1)]).toStrictEqual([1]);
  expect(() => [...range(3, 1)]).toThrow();
  expect([...cyclicRange(1, 3)]).toStrictEqual([1, 2, 0]);
  expect(() => [...cyclicRange(3, 1)]).toThrow();
  expect([...cyclicPairs(3)]).toStrictEqual([[0, 1], [1, 2], [2, 0]]);
  expect(() => [...cyclicPairs(-3)]).toThrow();
  expect([...cyclicPairs(0)]).toStrictEqual([]);
  expect([...rect(1, 1)]).toStrictEqual([[0, 0]]);
  expect([...rect(2, 2)]).toStrictEqual([[0, 0], [1, 0], [0, 1], [1, 1]]);
  expect(() => [...rect(-2, 2)]).toThrow();
});