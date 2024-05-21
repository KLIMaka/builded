import { enableMapSet } from "immer";
import { transformed, tuple, value } from "../src/utils/callbacks";

test('value', () => {
  const a = value(1);
  const log: number[] = [];
  a.subscribe(a => log.push(a));

  a.set(1);
  a.set(1);
  a.set(1);
  expect(log.length).toBe(0);

  a.set(2);
  a.set(2);
  a.set(2);
  expect(log).toStrictEqual([2]);
});

test('complex value', () => {
  const a = { first: 1, second: 'a' };
  const valueA = value(a);
  let changes = 0;
  valueA.subscribe(a => changes++);

  valueA.modImmer(a => a.first = 1);
  valueA.modImmer(a => a.second = 'a');
  expect(changes).toBe(0);

  valueA.modImmer(a => a.first = 42)
  expect(changes).toBe(1);

  valueA.modImmer(a => a.first = 42)
  valueA.modImmer(a => a.second = 'a')
  expect(changes).toBe(1);

  valueA.modImmer(a => { a.first = 1; a.second = 'b' })
  expect(changes).toBe(2);
})

test('set/map value', () => {
  enableMapSet();
  const a = { map: new Map<string, string>(), set: new Set<String>() };
  const valueA = value(a);
  let changes = 0;
  valueA.subscribe(_ => changes++);

  valueA.modImmer(a => a.set.add('42'));
  expect(changes).toBe(1);
  valueA.modImmer(a => a.set.add('42'));
  expect(changes).toBe(1);

  valueA.modImmer(a => a.map.set('key', 'value'));
  expect(changes).toBe(2);
  valueA.modImmer(a => a.map.set('key', 'value'));
  expect(changes).toBe(2);
});

test('transformed', () => {
  const src = value(42);
  const tsrc = transformed(src, v => v.toString());

  expect(tsrc.get()).toBe('42');

  const log: string[] = [];
  const disc = tsrc.subscribe(a => log.push(a), tsrc.mods());

  src.set(0);
  src.set(12);
  expect(log).toStrictEqual(['0', '12']);

  const tsrc1 = transformed(src, v => (v + 1).toString());
  expect(tsrc1.get()).toBe('13');

  const log1: string[] = [];
  const disc1 = tsrc1.subscribe(a => log1.push(a));

  src.set(0);
  src.set(42);
  expect(log1).toStrictEqual(['1', '43']);
  expect(log).toStrictEqual(['0', '12', '0', '42']);

  const tsrc2 = transformed(src, v => v * v + 1);
  expect(tsrc2.get()).toBe(42 * 42 + 1);

  expect((src as any).handlers.size).toBe(2);
  disc();
  expect((src as any).handlers.size).toBe(1);
  disc1();
  expect((src as any).handlers.size).toBe(0);

  src.set(1);
  src.set(2);

  expect(log1).toStrictEqual(['1', '43']);
  expect(log).toStrictEqual(['0', '12', '0', '42']);

  expect(tsrc.get()).toBe('2');
  expect(tsrc1.get()).toBe('3');
  expect(tsrc2.get()).toBe(2 * 2 + 1);
});

test('tuple1', () => {
  const a = value(1);
  const tr = transformed(a, x => x + 1);
  const t = tuple(a, tr);
  const tr1 = transformed(tuple(a, t), x => x.toString());

  const log: string[] = [];
  tr1.subscribe(a => log.push(a));

  a.set(42);
  expect(log).toStrictEqual(["42,42,43"]);
});

test('transformedTuple', () => {
  const a = value(1);
  const b = value(new Set<string>());
  const c = value('str');

  const t = transformed(tuple(a, b, c), ([a, b, c]) => (a + b.size) + c);
  const log: string[] = [];
  t.subscribe(t => log.push(t));

  expect(log).toStrictEqual([]);
  expect(t.get()).toBe('1str');
  expect(log).toStrictEqual(['1str']);

  b.set(new Set(['1', '2']));
  expect(log).toStrictEqual(['1str', '3str']);
});