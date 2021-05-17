import { NumberInterpolator } from "../src/utils/interpolator";
import { bilinear, perlin2d } from "../src/utils/mathutils";

test('interpolator', () => {
  const arr = [1, 2, 2, 1];
  const b = bilinear(2, 2, arr, NumberInterpolator);
  expect(b(0, 0.5)).toBe(1.5);
  expect(b(0.5, 0.5)).toBe(1.5);
});