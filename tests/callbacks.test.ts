import { enableMapSet } from "immer";
import { createContainer, transformed, transformedBuilder, value } from "../src/utils/callbacks";

test('value', () => {
  const a = value('a', 1);
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
  const valueA = value('a', a);
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
  const valueA = value('a', a);
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
  const src = value('src', 42);
  const tsrc = transformedBuilder<[number], string>({ name: 'tsrc', source: src, value: '', transformer: v => v.toString() });

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
  const values = createContainer('container');
  const a = values.value('a', 1);
  const tr = values.transformed('tr', a, x => x + 1);
  const tr1 = values.transformedTuple('tr1', [a, tr], x => x.toString());

  expect(() => values.transformedTuple('', [a, a], x => x.toString())).toThrow('Duplicate sources');
  expect(() => values.transformedTuple('', [tr, a], x => x.toString())).toThrow('Tuple with different order already exist');

  const log: string[] = [];
  tr1.subscribe(a => log.push(a));

  a.set(42);
  expect(log).toStrictEqual(["42,43"]);
});

test('transformedTuple', () => {
  const values = createContainer('container');
  const a = values.value('a', 1);
  const b = values.value('b', new Set<string>());
  const c = values.value('c', 'str');

  const t = values.transformedTuple('t', [a, b, c], ([a, b, c]) => (a + b.size) + c);
  const log: string[] = [];
  t.subscribe(t => log.push(t));

  expect(log).toStrictEqual([]);
  expect(t.get()).toBe('1str');
  expect(log).toStrictEqual([]);

  b.set(new Set(['1', '2']));
  expect(log).toStrictEqual(['3str']);
});

test('values container', async () => {
  const cont = createContainer('container');
  const log: string[] = [];
  const disposer = (arg: any) => log.push(`${arg} disposed`);
  const a = cont.valueBuilder({ name: 'a', value: 42, disposer })
  const b = cont.transformed('b', a, x => x * x, { disposer });
  const c = cont.transformedTuple('c', [a, b], ([a, b]) => a + b, { disposer });
  const d = cont.transformed('d', b, x => x + 1);

  expect(d.get()).toBe(42 * 42 + 1);
  expect(c.get()).toBe(42 * 42 + 42);
  expect(b.get()).toBe(42 * 42);

  a.set(11);
  expect(d.get()).toBe(11 * 11 + 1);
  expect(c.get()).toBe(11 * 11 + 11);
  expect(b.get()).toBe(11 * 11);

  await cont.dispose();
  expect(log).toStrictEqual([
    "42 disposed",
    `${42 * 42} disposed`,
    `${42 * 42 + 42} disposed`,
    `${11 * 11 + 11} disposed`,
    `${11 * 11} disposed`,
    "11 disposed",
  ]);
});

test('custom eq', () => {
  const values = createContainer('container');
  type T = { value: number };
  const a: T = { value: 42 };

  const value = values.valueBuilder({
    value: a,
    eq: (l, r) => l.value === r.value,
    setter: (dst, src) => { dst.value = src.value; return dst }
  });

  const a1 = { value: 42 };
  value.set(a1);
  expect(value.mods()).toBe(0);
  expect(value.get() === a).toBeTruthy();

  const b = { value: 12 };
  value.set(b);
  expect(value.mods()).toBe(1);
  expect(value.get() === a).toBeTruthy();
  expect(value.get() !== b).toBeTruthy();
  expect(value.get().value).toBe(12);
});