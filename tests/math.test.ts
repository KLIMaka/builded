import { mat2d, vec2 } from "gl-matrix";
import { NumberInterpolator } from "../src/utils/interpolator";
import { bilinear, deg2rad, nextpow2, optimize, quadratic, RadialSegments } from "../src/utils/mathutils";

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

test('radial segments', () => {
  const segments = new RadialSegments();
  expect(segments.getValue(0)).toBe(Number.MAX_VALUE);
  expect(segments.getValue(1)).toBe(Number.MAX_VALUE);
  expect(segments.getValue(0.5)).toBe(Number.MAX_VALUE);

  segments.add({ start: 0.1, end: 0.5, value: 1 });
  expect(segments.getValue(0.5)).toBe(1);
  expect(segments.getValue(0.1)).toBe(Number.MAX_VALUE);
  expect(segments.getValue(0.4)).toBe(1);
  expect(segments.getValue(0.01)).toBe(Number.MAX_VALUE);
  expect(segments.getValue(0.51)).toBe(Number.MAX_VALUE);
  expect(segments.getValue(0.9)).toBe(Number.MAX_VALUE);

  segments.add({ start: 0.8, end: 0.9, value: 2 });
  expect(segments.getValue(0.8)).toBe(Number.MAX_VALUE);
  expect(segments.getValue(0.85)).toBe(2);
  expect(segments.getValue(0.9)).toBe(2);

  segments.add({ start: 0.2, end: 0.85, value: 0.1 });
  expect(segments.getValue(0.85)).toBe(0.1);
  expect(segments.getValue(0.9)).toBe(2);
  expect(segments.getValue(0.5)).toBe(0.1);
  expect(segments.getValue(0.2)).toBe(1);

  segments.add({ start: 0.5, end: 0.9, value: 1 });
  expect(segments.getValue(0.85)).toBe(0.1);
  expect(segments.getValue(0.9)).toBe(1);
  expect(segments.getValue(0.5)).toBe(0.1);
  expect(segments.getValue(0.2)).toBe(1);

  segments.add({ start: 0, end: 0.5, value: 0.2 });
  expect(segments.getValue(0)).toBe(0.2);
  expect(segments.getValue(0.2)).toBe(0.2);
  expect(segments.getValue(0.21)).toBe(0.1);

  segments.add({ start: 0.9, end: 1, value: 0.5 });
  expect(segments.getValue(0.9)).toBe(1);
  expect(segments.getValue(1)).toBe(0.5);

  segments.add({ start: 0, end: 1, value: 0.001 });
  expect(segments.getValue(0)).toBe(0.001);
  expect(segments.getValue(0.1)).toBe(0.001);
  expect(segments.getValue(0.5)).toBe(0.001);
  expect(segments.getValue(0.9)).toBe(0.001);
  expect(segments.getValue(1)).toBe(0.001);

  const segments1 = new RadialSegments();
  expect(segments1.scan({ start: 0, end: 1, value: 1 })).toBe(true);

  segments1.add({ start: 0.5, end: 0.6, value: 0.5 });
  expect(segments1.scan({ start: 0, end: 1, value: 1 })).toBe(true);
  expect(segments1.scan({ start: 0.51, end: 0.52, value: 1 })).toBe(false);

  const segments2 = new RadialSegments();
  segments2.add({ start: 0.9, end: 0.1, value: 1 });
  expect(segments2.getValue(0.5)).toBe(Number.MAX_VALUE);
  expect(segments2.getValue(0)).toBe(1);
})

test('nextpow2', () => {
  expect(nextpow2(7)).toBe(8);
  expect(nextpow2(8)).toBe(8);
  expect(nextpow2(155)).toBe(256);
})