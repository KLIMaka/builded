import { Rasterizer } from "../src/utils/rasterizer";

test('Rasterizer', () => {
  const data = new Uint8Array(1024);
  const WHITE = [255, 255, 255, 255];
  const BLACK = [0, 0, 0, 0];
  const rast = new Rasterizer(data, 2, 2, attrs => WHITE);

  rast.clear(WHITE, 0);
  expect([...data.subarray(0, 4 * 4 + 1)]).toStrictEqual([255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 0]);


  rast.clear(BLACK, 0);
  rast.bindAttributes(0, [0, 0, 1, 0, 1, 1], 2);
  [...rast.drawTriangles([0, 1, 2])];
  expect([...data.subarray(0, 4 * 4)]).toStrictEqual([0, 0, 0, 0, 255, 255, 255, 255, 0, 0, 0, 0, 0, 0, 0, 0]);

  rast.clear(BLACK, 0);
  rast.bindAttributes(0, [0, 0, 0, 1, 1, 1], 2);
  [...rast.drawTriangles([0, 1, 2])];
  expect([...data.subarray(0, 4 * 4)]).toStrictEqual([255, 255, 255, 255, 0, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255]);

  const rast1 = new Rasterizer(data, 2, 2, attrs => [attrs[0] * 255, attrs[1] * 255, 0, 255]);
  rast1.clear(BLACK, 0);
  rast1.bindAttributes(0, [0.1, 0.1, 0.1, 0.9, 0.9, 0.9, 0.9, 0], 2);
  [...rast1.drawTriangles([0, 1, 2, 0, 2, 3])];
  expect([...data.subarray(0, 4 * 4)]).toStrictEqual([63, 63, 0, 255, 191, 63, 0, 255, 63, 191, 0, 255, 191, 191, 0, 255]);
});