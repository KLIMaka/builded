import { KDTree } from '../src/utils/kdtree'

test("kdtree", () => {
  const points: [number, number][] = [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 0],
    [1, 1],
    [1, 2],
    [2, 0],
    [2, 1],
    [2, 2]
  ]

  const tree = new KDTree(points);
  expect(tree.closest([0, 0])[0]).toBe(0);
  expect(tree.closest([0.499, 0])[0]).toBe(0);
  expect(tree.closest([0.5, 0])[0]).toBe(3);
  expect(tree.closest([1.5, 1.2])[0]).toBe(7);
  expect(tree.closest([4, 4])[0]).toBe(8);
  expect(tree.closest([-1, 1])[0]).toBe(1);
})