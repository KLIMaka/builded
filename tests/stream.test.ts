import { Stream, byte, atomic_array, struct, bits, Accessor, ubyte, short, ushort, int, uint, float, string, array } from '../src/utils/stream';

class Test {
  a: number;
  b: number;
  c: number;
}

function check<T>(stream: Stream, accessor: Accessor<T>, value: T): void {
  stream.setOffset(0);
  accessor.write(stream, value);
  stream.setOffset(0);
  expect(accessor.read(stream)).toStrictEqual(value);
}

test('write', () => {
  const buffer = new ArrayBuffer(32);
  const stream = new Stream(buffer, true);

  check(stream, byte, 42);
  check(stream, ubyte, 42);
  check(stream, short, 42);
  check(stream, ushort, 42);
  check(stream, int, 42);
  check(stream, uint, 42);
  check(stream, float, 42);
  check(stream, string(10), "42");
  check(stream, array(byte, 4), [1, 2, -3, -4]);
  check(stream, atomic_array(byte, 4), new Int8Array([1, 2, -3, -4]));

  const s = struct(Test)
    .field('a', byte)
    .field('b', bits(4))
    .field('c', bits(-4));
  stream.setOffset(0);
  const t = new Test();
  t.a = 12;
  t.b = 4;
  t.c = -4;
  atomic_array(byte, 2).write(stream, new Int8Array([12, 0b11000100]));
  stream.setOffset(0);
  expect(s.read(stream)).toStrictEqual(t);

  stream.setOffset(0);
  s.write(stream, t);
  stream.setOffset(0);
  expect(s.read(stream)).toStrictEqual(t);
})