import { NumberInterpolator } from "../src/utils/interpolator";
import { bilinear, optimize, quadratic } from "../src/utils/mathutils";

test('interpolator', () => {
  const arr = [1, 2, 2, 1];
  const b = bilinear(2, 2, arr, NumberInterpolator);
  expect(b(0, 0.5)).toBe(1.5);
  expect(b(0.5, 0.5)).toBe(1.5);
});

test('quadric', () => {
  const x0 = 0;
  const x1 = 3;
  const x2 = 2;

  expect(quadratic(x0, x1, x2, 0)).toBe(0);
  expect(quadratic(x0, x1, x2, 1)).toBe(2);
  expect(quadratic(x0, x1, x2, 0.5)).toBe(3);
  expect(quadratic(x0, x1, x2, 0.25)).toBe(2);
  expect(quadratic(x0, x1, x2, 0.75)).toBe(3);
});

test('optimize', () => {
  // const f = (x: number) => x;
  // expect(optimize(x => x)).toBe(0);
  // expect(optimize(x => Math.pow(x + 1, 2), 5)).toBeCloseTo(-1);
  // expect(optimize(x => Math.pow(x - 3, 2), 5)).toBeCloseTo(3);
})