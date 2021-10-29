import { Value, handle, value, transformed, delay, tuple } from "../src/utils/callbacks";

test('value', () => {
  const a = value(1);
  const log: number[] = [];
  a.add(() => log.push(a.get()));

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
  tsrc.add(() => log.push(tsrc.get()));

  src.set(0);
  src.set(12);
  expect(log).toStrictEqual(['0', '12']);

  const tsrc1 = transformed(src, v => v * v + 1);
  expect(tsrc1.get()).toBe(12 * 12 + 1);
});

test('delay', async done => {
  const src = value(42);
  const tsrc = transformed(src, v => v.toString());

  const log: string[] = [];
  const dsrc = delay(tsrc);
  dsrc.add(() => log.push(dsrc.get()));

  src.set(1);
  expect(src.get()).toBe(1);
  src.set(2);
  expect(src.get()).toBe(2);
  src.set(3);
  expect(src.get()).toBe(3);
  expect(log).toStrictEqual([]);

  setTimeout(() => {
    expect(log).toStrictEqual(['3']);
    done();
  });
});

test('tuple', async done => {
  const a = value(1);
  const b = value(2);
  const t = tuple(a, b);
  const d = delay(t);

  const log1: [number, number][] = [];
  const log2: [number, number][] = [];
  t.add(() => log1.push(t.get()));
  d.add(() => log2.push(d.get()));

  a.set(42);
  b.set(42);
  expect(t.get()).toStrictEqual([42, 42]);
  expect(d.get()).toStrictEqual([42, 42]);
  expect(log1).toStrictEqual([[42, 2], [42, 42]]);
  expect(log2).toStrictEqual([]);

  setTimeout(() => {
    expect(log2).toStrictEqual([[42, 42]]);
    done();
  });
});

test('tuple1', () => {
  const a = value(1);
  const tr = transformed(a, x => x + 1);
  const t = tuple(a, tr);
  const tr1 = transformed(tuple(a, t), x => x.toString());

  const log: string[] = [];
  tr1.add(() => log.push(tr1.get()));

  a.set(42);
  expect(log).toStrictEqual(["42,42,43", "42,42,43", "42,42,43"]);
});