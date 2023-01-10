import { vec3 } from "../src/libs_js/glmatrix";
import { polygonNormal, project3d } from "../src/utils/vecmath";

test('VecMath', () => {
  const a = vec3.fromValues(0, 0, 0);
  const b = vec3.fromValues(1, 0, 0);
  const c = vec3.fromValues(1, 1, 0);

  expect(polygonNormal([a, b, c])).toStrictEqual(vec3.fromValues(0, 0, 1));
  expect(polygonNormal([c, b, a])).toStrictEqual(vec3.fromValues(0, 0, -1));

  const n1 = vec3.fromValues(0, 1, 0);
  expect(project3d([a, b, c], n1)).toStrictEqual([[0, 0], [-1, 0], [-1, 0]]);

  const n2 = vec3.fromValues(0, 0, -1);
  expect(project3d([a, b, c], n2)).toStrictEqual([[0, 0], [-1, 0], [-1, 1]]);
});