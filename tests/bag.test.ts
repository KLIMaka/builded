import { Bag, BagController, Place } from "../src/utils/bag"

test('bag', () => {
  const bag = new Bag(1024);

  expect(bag.get(1025)).toBe(null);
  expect(bag.get(512)).toBe(0);
  expect(bag.get(16)).toBe(512);
  bag.put(0, 16)
  bag.put(128, 32)
  bag.put(256, 128)
  expect([...bag.holes]).toStrictEqual([new Place(0, 16), new Place(128, 32), new Place(256, 128), new Place(528, 496)]);
  expect(bag.get(512)).toBe(null);
  expect(bag.get(8)).toBe(0);
  expect(bag.get(8)).toBe(8);
  expect(bag.get(128)).toBe(256);
  expect(bag.get(16)).toBe(128);
  expect([...bag.holes]).toStrictEqual([new Place(144, 16), new Place(528, 496)]);
});

test('bag controller', () => {
  const updater = (place: Place, noffset: number) => { }
  const controller = new BagController(1024, updater);
  const p1 = controller.get(128);
  const p2 = controller.get(128);
  const p3 = controller.get(128);
  const p4 = controller.get(128);
  expect(p2).toStrictEqual(new Place(128, 128));
  expect(p4).toStrictEqual(new Place(384, 128));
  controller.put(p1);
  controller.put(p3);
  controller.optimize();
  expect(p2).toStrictEqual(new Place(0, 128));
  expect(p4).toStrictEqual(new Place(128, 128));
})