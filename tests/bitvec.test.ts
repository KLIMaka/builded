import { Bitvec } from "../src/utils/bitvec"

test('bitvec', () => {
  const bitvec = new Bitvec(1);

  bitvec.set(0, true);
  expect(bitvec.get(0)).toBe(true);
  expect(bitvec.check(0, true)).toBe(1);
  expect(bitvec.get(1)).toBe(false);

  bitvec.fill(1, 7, true);
  expect(bitvec.check(0, true)).toBe(8);
  expect(bitvec.get(1)).toBe(true);

  bitvec.fill(8, 8, true);
  expect(bitvec.check(8, true)).toBe(8);
  expect(bitvec.get(8)).toBe(true);

  bitvec.set(24, true);
  expect(bitvec.check(0, true)).toBe(16);
  expect(bitvec.check(16, false)).toBe(8);
})