import { Callback, DefaultScheduler } from "../src/app/modules/default/app/scheduler";
import { getOrCreate } from "../src/utils/collections";


async function run(cb: Callback<void>): Promise<void> {
  cb();
  return new Promise<void>(ok => setTimeout(ok));
}

const counts = new Map<number, Callback<void>[]>();
function on(c: number) {
  return new Promise<void>(ok => {
    const cbs = getOrCreate(counts, c, () => []);
    cbs.push(ok);
  });
}

function count(c: number) {
  const cbs = counts.get(c);
  if (cbs == undefined) return;
  for (const cb of cbs) cb();
}

test('Scheduler', async () => {
  let cb: Callback<void> = () => { };
  const s = DefaultScheduler(c => cb = c);
  const nextLoop = () => run(cb);
  let counter = 0;
  let x = 0;
  let y = 0;

  expect(x).toBe(0);
  s.exec(async h => {
    x = 1;
    await h.wait();
    x = 2;
    await h.wait();
  });
  const nnH = s.exec(async h => {
    await h.waitFor(on(5));
    x = 99;
  });
  s.exec(async h => {
    await h.waitFor(on(3));
    y = 1;
  })
  s.exec(async h => {
    await h.waitFor(on(8));
    y = 2;
  })
  const counterH = s.exec(async h => {
    for (; ;) {
      count(++counter);
      await h.wait();
    }
  });

  expect(x).toBe(1);
  expect(y).toBe(0);
  expect(counter).toBe(1);

  await nextLoop();
  expect(x).toBe(2);
  expect(y).toBe(0);
  expect(counter).toBe(2);

  nnH.pause();

  await nextLoop();
  expect(x).toBe(2);
  expect(y).toBe(0);
  expect(counter).toBe(3);

  await nextLoop();
  expect(x).toBe(2);
  expect(y).toBe(1);
  expect(counter).toBe(4);

  await nextLoop();
  expect(x).toBe(2);
  expect(y).toBe(1);
  expect(counter).toBe(5);

  await nextLoop();
  expect(x).toBe(2);
  expect(y).toBe(1);
  expect(counter).toBe(6);

  await nextLoop();
  expect(x).toBe(2);
  expect(y).toBe(1);
  expect(counter).toBe(7);

  nnH.unpause();
  expect(x).toBe(2);
  expect(y).toBe(1);
  expect(counter).toBe(7);

  await nextLoop();
  expect(x).toBe(99);
  expect(y).toBe(1);
  expect(counter).toBe(8);

  counterH.pause();
  expect(y).toBe(1);
  expect(counter).toBe(8);
  await nextLoop();
  expect(counter).toBe(8);
  await nextLoop();
  expect(counter).toBe(8);

  counterH.unpause();
  expect(counter).toBe(8);

  await nextLoop();
  expect(y).toBe(2);
  expect(counter).toBe(9);
})