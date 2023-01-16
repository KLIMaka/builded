import { vec3 } from "../src/libs_js/glmatrix";
import { polygonNormal, project3d, projectionSpace } from "../src/utils/vecmath";

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


  // const v1 = vec3.fromValues(0, 0, 0);
  // const v2 = vec3.fromValues(1, 1, 1);
  // const v3 = vec3.fromValues(1, 1, -1);
  // const vtxs = [v2, v3, v1];
  // const n = polygonNormal(vtxs);
  // const ps = projectionSpace(vtxs, n);
  // expect(ps).toStrictEqual([
  //   -0.5773502588272095,
  //   -0.40824830532073975,
  //   -0.7071067690849304,
  //   -0.5773502588272095,
  //   -0.40824830532073975,
  //   0.7071067690849304,
  //   -0.5773502588272095,
  //   0.8164966106414795,
  //   0
  // ]);
  // expect(vec3.transformMat3(vec3.create(), v1, ps)).toStrictEqual([-0, 0, 0]);
  // expect(vec3.transformMat3(vec3.create(), v2, ps)).toBe([-1.7320507764816284, 0, 0]);
  // expect(vec3.transformMat3(vec3.create(), v3, ps)).toStrictEqual([-0, 0, 0]);
});