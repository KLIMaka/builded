import { array, Raster, resize, superResize } from '../src/utils/pixelprovider';

const rasterizer = (r: Raster<number>) => {
  const out = [];
  let i = 0;
  for (let y = 0; y < r.height; y++)
    for (let x = 0; x < r.width; x++)
      out[i++] = r.pixel(x, y);
  return out;
}

test('resize', () => {
  const img = [1, 1, 2, 2];
  const pp = array(img, 2, 2);
  expect(rasterizer(pp)).toStrictEqual([1, 1, 2, 2]);

  const resizepp = resize(pp, 4, 4);
  expect(rasterizer(resizepp)).toStrictEqual([
    1, 1, 1, 1,
    1, 1, 1, 1,
    2, 2, 2, 2,
    2, 2, 2, 2
  ]);
});

test('superResize', () => {
  const img = [1, 2, 2, 1];
  const pp = array(img, 2, 2);
  const resizepp = superResize(pp, 4, 4, (l, r) => l == r ? l : null);
  expect(rasterizer(resizepp)).toStrictEqual([
    1, 1, 2, 2,
    1, 1, 1, 2,
    2, 1, 1, 1,
    2, 2, 1, 1,
  ]);
});