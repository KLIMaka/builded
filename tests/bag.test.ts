import { Bag, BagController, Place } from "../src/utils/bag";
import { coin, randInt, randInt0 } from "../src/utils/random";

test('bag', () => {
  const bag = new Bag(1024);

  expect(bag.get(1025)).toBe(null);
  expect(bag.get(512)).toBe(0);
  expect(bag.get(16)).toBe(512);
  bag.put(0, 16)
  bag.put(128, 32)
  bag.put(256, 128)
  expect(bag.getHoles()).toStrictEqual([new Place(0, 16), new Place(128, 32), new Place(256, 128), new Place(528, 496)]);
  expect(bag.get(512)).toBe(null);
  expect(bag.get(8)).toBe(0);
  expect(bag.get(8)).toBe(8);
  expect(bag.get(128)).toBe(256);
  expect(bag.get(16)).toBe(128);
  expect(bag.getHoles()).toStrictEqual([new Place(144, 16), new Place(528, 496)]);
});

test('bag controller', () => {
  const N = 1024;
  const buff = new Uint16Array(N);
  const updater = (place: Place, noffset: number) => {
    buff.set(buff.subarray(place.offset, place.offset + place.size), noffset);
  }
  const controller = new BagController(N, updater);
  const get = (size: number) => {
    const p = controller.get(size);
    if (p == null) return null;
    const x = p.data = randInt0(N);
    for (let i = 0; i < size; i++) buff[i + p.offset] = i + x;
    return p;
  }
  const check = (p: Place) => {
    const x: number = p.data;
    for (let i = 0; i < p.size; i++) if (buff[i + p.offset] != x + i) return false;
    return true;
  }

  // function toChar(x: number) { return x < 0.25 ? '.' : x < 0.5 ? '-' : x < 0.75 ? '+' : '#' };
  const places: Place[] = [];
  for (let p = get(randInt(8, 16)); p != null; p = get(randInt(8, 16))) places.push(p);
  // console.log(controller.freeSpace(80).map(toChar).join(''));
  const validPlaces: Place[] = [];
  for (const p of places) {
    if (coin()) controller.put(p);
    else validPlaces.push(p);
  }
  // console.log(controller.freeSpace(80).map(toChar).join(''));

  controller.optimize();
  // console.log(controller.freeSpace(80).map(toChar).join(''));
  for (const p of validPlaces) expect(check(p)).toBe(true);
})