import { buildHull, point_3d, Point } from '../src/app/edit/tools/drawwall';
import { cyclic } from '../src/utils/mathutils';

const proj = (x: number, y: number) => <[number, number, number]>[0, 0, x];

function shift(points: point_3d[], off: number): point_3d[] {
  const npoints = [];
  for (let i = 0; i < points.length; i++)npoints.push(points[cyclic(i + off, points.length)]);
  return npoints;
}

test('quad', () => {
  const points: point_3d[] = [[0, 0, 100], [100, 0, 100], [100, 0, 0], [0, 0, 0]];

  for (let i = 0; i < points.length; i++) {
    const hull = buildHull(shift(points, i), proj);
    expect(hull.length).toBe(2);
    expect(hull[0]).toStrictEqual(new Point(0, 0, 0, 100, 0));
    expect(hull[1]).toStrictEqual(new Point(100, 0, 0, 100, 0, -100));
  }
})

test('tri', () => {
  const points: point_3d[] = [[50, 0, 100], [100, 0, 0], [0, 0, 0]];

  for (let i = 0; i < points.length; i++) {
    const hull = buildHull(shift(points, i), proj);
    expect(hull.length).toBe(3);
    expect(hull[0]).toStrictEqual(new Point(0, 0, 0, 0));
    expect(hull[1]).toStrictEqual(new Point(50, 0, 0, 100, 0));
    expect(hull[2]).toStrictEqual(new Point(100, 0, 0, 0));
  }
})

test('home', () => {
  const points: point_3d[] = [[0, 0, 100], [50, 0, 150], [100, 0, 100], [100, 0, 0], [0, 0, 0]];

  for (let i = 0; i < points.length; i++) {
    const hull = buildHull(shift(points, i), proj);
    expect(hull.length).toBe(3);
    expect(hull[0]).toStrictEqual(new Point(0, 0, 0, 100, 0));
    expect(hull[1]).toStrictEqual(new Point(50, 0, 0, 150, 0));
    expect(hull[2]).toStrictEqual(new Point(100, 0, 0, 100, 0, -100));
  }
})

test('L', () => {
  const points: point_3d[] = [[0, 0, 100], [50, 0, 100], [50, 0, 50], [100, 0, 50], [100, 0, 0], [0, 0, 0]];
  for (let i = 0; i < points.length; i++) {
    const hull = buildHull(shift(points, i), proj);
    expect(hull.length).toBe(3);
    expect(hull[0]).toStrictEqual(new Point(0, 0, 0, 100, 0));
    expect(hull[1]).toStrictEqual(new Point(50, 0, 0, 100, 0, -50));
    expect(hull[2]).toStrictEqual(new Point(100, 0, 0, 50, 0, -50));
  }
})

test('U', () => {
  const points: point_3d[] = [[0, 0, 100], [50, 0, 100], [50, 0, 50], [100, 0, 50], [100, 0, 100], [150, 0, 100], [150, 0, 0], [0, 0, 0]];
  for (let i = 0; i < points.length; i++) {
    const hull = buildHull(shift(points, i), proj);
    expect(hull.length).toBe(4);
    expect(hull[0]).toStrictEqual(new Point(0, 0, 0, 100, 0));
    expect(hull[1]).toStrictEqual(new Point(50, 0, 0, 100, 0, -50));
    expect(hull[2]).toStrictEqual(new Point(100, 0, 0, 50, 0, 50));
    expect(hull[3]).toStrictEqual(new Point(150, 0, 0, 100, 0, -100));
  }
})

test('П', () => {
  const points: point_3d[] = [[0, 0, 100], [150, 0, 100], [150, 0, 0], [100, 0, 0], [100, 0, 50], [50, 0, 50], [50, 0, 0], [0, 0, 0]];
  for (let i = 0; i < points.length; i++) {
    const hull = buildHull(shift(points, i), proj);
    expect(hull.length).toBe(4);
    expect(hull[0]).toStrictEqual(new Point(0, 0, 0, 100, 0));
    expect(hull[1]).toStrictEqual(new Point(50, 0, 0, 100, 0, 0, 50));
    expect(hull[2]).toStrictEqual(new Point(100, 0, 0, 100, 50, 0, -50));
    expect(hull[3]).toStrictEqual(new Point(150, 0, 0, 100, 0, -100));
  }
})