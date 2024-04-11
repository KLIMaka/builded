import { handle, transformed, tuple, value } from "../src/utils/callbacks";

test('value', () => {
  const a = value(1);
  const log: number[] = [];
  a.add(a => log.push(a));

  a.set(1);
  a.set(1);
  a.set(1);
  expect(log.length).toBe(0);

  a.set(2);
  a.set(2);
  a.set(2);
  expect(log).toStrictEqual([2]);
});

test('handler', () => {
  const a = value(1);
  const b = value(2);
  const c = value(3);
  const log: string[] = [];

  const h = handle(null, (p, a, b) => {
    log.push(`a=${a} b=${b}`);
    handle(p, (p, c) => {
      log.push(`c=${c}`);
    }, c);
  }, a, b);

  expect(log).toStrictEqual(['a=1 b=2', 'c=3']);

  c.set(9);
  expect(log).toStrictEqual(['a=1 b=2', 'c=3', 'c=9']);

  a.set(9);
  expect(log).toStrictEqual(['a=1 b=2', 'c=3', 'c=9', 'a=9 b=2', 'c=9']);

  c.set(10);
  expect(log).toStrictEqual(['a=1 b=2', 'c=3', 'c=9', 'a=9 b=2', 'c=9', 'c=10']);

  h.stop();
  a.set(42);
  expect(log).toStrictEqual(['a=1 b=2', 'c=3', 'c=9', 'a=9 b=2', 'c=9', 'c=10']);

  h.update();
  expect(log).toStrictEqual(['a=1 b=2', 'c=3', 'c=9', 'a=9 b=2', 'c=9', 'c=10', 'a=42 b=2', 'c=10']);

  c.set(42);
  expect(log).toStrictEqual(['a=1 b=2', 'c=3', 'c=9', 'a=9 b=2', 'c=9', 'c=10', 'a=42 b=2', 'c=10', 'c=42']);
});

test('transformed', () => {
  const src = value(42);
  const tsrc = transformed(src, v => v.toString());

  expect(tsrc.get()).toBe('42');

  const log: string[] = [];
  tsrc.add(a => log.push(a));

  src.set(0);
  src.set(12);
  expect(log).toStrictEqual(['0', '12']);

  const tsrc1 = transformed(src, v => v * v + 1);
  expect(tsrc1.get()).toBe(12 * 12 + 1);
});

test('tuple1', () => {
  const a = value(1);
  const tr = transformed(a, x => x + 1);
  const t = tuple(a, tr);
  const tr1 = transformed(tuple(a, t), x => x.toString());

  const log: string[] = [];
  tr1.add(a => log.push(a));

  a.set(42);
  expect(log).toStrictEqual(["42,42,43"]);
});