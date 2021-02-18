import { ResizePixelProvider, RGBAArrayPixelProvider, SuperResizePixelProvider } from '../src/utils/pixelprovider';

test('resize', () => {
  const img = new Uint8Array([
    0, 0, 0, 255, 255, 0, 0, 255,
    0, 0, 0, 255, 255, 0, 0, 255,
  ]);
  const pp = new RGBAArrayPixelProvider(img, 2, 2);
  const dest = new Uint8Array(4 * 4);
  pp.render(dest);
  expect(dest).toStrictEqual(new Uint8Array([
    0, 0, 0, 255, 255, 0, 0, 255,
    0, 0, 0, 255, 255, 0, 0, 255,
  ]));

  const resizepp = new ResizePixelProvider(pp, 4, 4);
  const resizeDest = new Uint8Array(16 * 4);
  resizepp.render(resizeDest);
  expect(resizeDest).toStrictEqual(new Uint8Array([
    0, 0, 0, 255, 0, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255,
    0, 0, 0, 255, 0, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255,
    0, 0, 0, 255, 0, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255,
    0, 0, 0, 255, 0, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255,
  ]));
});

test('superResize', () => {
  const img = new Uint8Array([
    255, 0, 0, 255, 0, 0, 0, 255,
    0, 0, 0, 255, 0, 0, 0, 255,
  ]);
  const pp = new RGBAArrayPixelProvider(img, 2, 2);
  const resizepp = new SuperResizePixelProvider(pp, 4, 4);
  const resizeDest = new Uint8Array(16 * 4);
  resizepp.render(resizeDest);
  expect(resizeDest).toStrictEqual(new Uint8Array([
    255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255,
    255, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255,
    0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255,
    0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255,
  ]));

});