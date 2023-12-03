import { Callback } from "../src/app/apis/app1";
import { DefaultScheduler } from "../src/app/modules/default/app/scheduler";
import { getOrCreate } from "../src/utils/collections";


async function run(cb: Callback<number>): Promise<void> {
  cb(0);
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

test('Scheduler1', async () => {
  let cb: Callback<number> = () => { };
  const s = DefaultScheduler(c => cb = c);
  const nextLoop = () => run(cb);
  let barrier: Callback<void> | undefined;
  let x = 0;
  let r = 0;

  s.exec(async h => {
    async function a() {
      await h.wait();
      x = 1;
      await h.wait();
      r = await h.waitFor(b());
      x = 4;
    }
    async function b() {
      x = 2;
      await h.waitFor(new Promise<void>(ok => barrier = ok));
      x = 3;
      return 42;
    }
    await h.waitFor(a());
    x = 5;
  });

  expect(x).toBe(0);
  await nextLoop();
  expect(x).toBe(1);
  await nextLoop();
  expect(x).toBe(2);
  await nextLoop();
  await nextLoop();
  expect(x).toBe(2);
  barrier?.();
  expect(x).toBe(2);
  await nextLoop();
  await nextLoop();
  expect(x).toBe(3);
  expect(r).toBe(0);
  await nextLoop();
  expect(x).toBe(4);
  expect(r).toBe(42);
  await nextLoop();
  expect(x).toBe(5);
});

test('Scheduler', async () => {
  let cb: Callback<number> = () => { };
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