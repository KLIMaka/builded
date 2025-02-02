import { Packer } from '../src/utils/texcoordpacker';

test('TC Packer', () => {
  const packer = new Packer(1024, 1024, 1, 1);
  const r1 = packer.pack(510, 512);
  const r2 = packer.pack(510, 512);

  expect(r1.xoff).toBe(1);
  expect(r1.yoff).toBe(1);
  expect(r2.xoff).toBe(513);
  expect(r2.yoff).toBe(1);

  const r3 = packer.pack(510, 120);
  expect(r3.xoff).toBe(513);
  expect(r3.yoff).toBe(515);

  const r4 = packer.pack(200, 200);
  expect(r4.xoff).toBe(513);
  expect(r4.yoff).toBe(637);

  expect(packer.pack(1024, 1024)).toBeUndefined();
});