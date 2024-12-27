import { DefaultScheduler } from "../src/app/modules/scheduler/scheduler";
import { WorkBuilder } from "../src/app/modules/scheduler/work";
import { getOrCreate, range } from "../src/utils/collections";
import { Consumer, pair } from "../src/utils/types";


async function run(cb: Consumer<number>): Promise<void> {
  cb(0);
  return new Promise<void>(ok => setTimeout(ok));
}

const counts = new Map<number, Consumer<void>[]>();
function on(c: number) {
  return new Promise<void>(ok => {
    const cbs = getOrCreate(counts, c, () => []);
    cbs.push(ok);
  });
}

function count(c: number) {
  const cbs = counts.get(c);
  if (cbs === undefined) return;
  for (const cb of cbs) cb();
}

test('Task', async () => {
  let cb: Consumer<number> = () => { };
  const s = DefaultScheduler(c => cb = c);
  const nextLoop = () => run(cb);

  let x = 0;

  const controller1 = s.exec<void>(async h => {
    x = 1;
    await h.wait();
    x = 2;
  });


  expect(x).toBe(1);
  await nextLoop();
  await controller1.end();
  expect(x).toBe(2)

  x = 0;
  const controller2 = s.exec(async h => {
    x = 1;
    await h.wait();
    x = 2;
    await h.wait();
    x = 3;
    throw new Error();
  });

  controller2.stop();
  expect(x).toBe(1);
  await nextLoop();
  expect(x).toBe(1);
  await nextLoop();
  expect(x).toBe(1);
  expect(async () => controller2.end().then(r => r.isErr())).toBeTruthy();

  x = 0;
  const controller3 = s.exec<number>(async h => {
    x = 1;
    await h.wait();
    return 42;
  });

  expect(x).toBe(1);
  expect(controller3.task.get().isDone()).toBe(false);
  await nextLoop();
  expect(controller3.task.get().isDone()).toBe(true);
  expect(controller3.task.get().result().getOk()).toBe(42);
});

test('Scheduler1', async () => {
  let cb: Consumer<number> = () => { };
  const s = DefaultScheduler(c => cb = c);
  const nextLoop = () => run(cb);
  let barrier: Consumer<void> | undefined;
  let x = 0;
  let r = 0;

  const task = s.exec(async h => {
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
  expect(x).toBe(5);
  expect(r).toBe(42);
  expect(task.task.get().isDone()).toBeTruthy();
});

test('Scheduler', async () => {
  let cb: Consumer<number> = () => { };
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
  expect(y).toBe(1);
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
  expect(y).toBe(2);
  expect(counter).toBe(8);

  counterH.pause();
  expect(y).toBe(2);
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

test('Work', async () => {
  let cb: Consumer<number> = () => { };
  const s = DefaultScheduler(c => cb = c);
  const nextLoop = () => run(cb);

  const work = new WorkBuilder()
    .then('step1', async () => 42)
    .then('step2', async i => i + 10)
    .then('step3', async i => i.toString() + 'ff')
    .thenPass('step4', async i => pair(i, 42))
    .thenPass('step5', async (a, [b, c]) => 42)
    .finish();

  const task = s.exec(work);
  expect(task.progress.get()).toBe(0);
  await nextLoop();
  expect(task.progress.get()).toBe(100);
  expect(task.task.get().result().getOk()).toStrictEqual(['52ff', ['52ff', 42], 42]);

  const work1 = new WorkBuilder()
    .then('step1', async () => 42)
    .thenPass('step2', async a => a + 11)
    .thenPass('step3', async (a, b) => a + b)
    .thenPass('step4', async (a, b, c) => a + b + c)
    .finish();

  const task1 = s.exec(work1);
  await nextLoop();
  expect(task1.task.get().result().getOk()).toStrictEqual([42, 53, 95, 190]);

  const work2 = new WorkBuilder()
    .input<[number, number]>()
    .then('step1', async ([a, b]) => a + b)
    .finish();

  const task2 = s.exec(async handle => work2(handle, [1, 2]));
  await nextLoop();
  expect(task2.task.get().result().getOk()).toStrictEqual([3]);

  const work3 = new WorkBuilder()
    .multiInput<[number, number]>()
    .then('step1', async (a, b) => a + b)
    .finish([1, 2]);

  const task3 = s.exec(async handle => work3(handle, 1, 2));
  await nextLoop();
  await nextLoop();
  expect(task3.task.get().result().getOk()).toStrictEqual([3]);

  const work4 = new WorkBuilder()
    .then('step1', async () => 42)
    .thenPass('step2', async a => a.toString())
    .fork(p => p
      .thread('p1', async (a, b) => pair(a * 10, b + 'a'))
      .thread('p2', async (a, b) => pair(a / 10, b + 'b')))
    .then('step3', async ([a1, b1], [a2, b2]) => pair(a1 + a2, b1 + b2))
    .finishUntuple();

  const task4 = s.exec(work4);
  await nextLoop();
  expect(task4.task.get().result().getOk()).toStrictEqual([424.2, '42a42b']);

  const work5 = new WorkBuilder()
    .then('step1', async () => 5)
    .thenPass('step2', async n => [...range(1, n + 1)])
    .factory((w, a, is) =>
      w.forkItems(is, i => `p${i}`, i => Promise.resolve(i * 100))
        .finish())
    .then('step3', async is => is.map(i => i.toString()))
    .finish();

  const task5 = s.exec(work5);
  await nextLoop();
  expect(task5.task.get().result().getOk()).toStrictEqual([['100', '200', '300', '400', '500']]);

  const work61 = new WorkBuilder()
    .multiInput<[number, [number, number]]>()
    .thenPass('step2', async (a, [b, c]) => [a, b, c])
    .finish();
  const work6 = new WorkBuilder()
    .then('step1', async () => 42)
    .forkPass(p => p
      .thread('p1', async i => i * 10)
      .thread('p2', async i => i + 10))
    .thenWork(work61)
    .then('step3', async (a, [b, c], is) => is.map(i => i + 2))
    .finishUntuple();

  const task6 = s.exec(work6);
  await nextLoop();
  expect(task6.task.get().result().getOk()).toStrictEqual([44, 422, 54]);

  const work7 = new WorkBuilder()
    .forkItems([1, 2, 3], i => i.toString(), async i => Promise.resolve(i))
    .then('step2', async is => is.map(i => i * 2))
    .finishUntuple();

  const task7 = s.exec(work7);
  await nextLoop();
  expect(task7.task.get().result().getOk()).toStrictEqual([2, 4, 6]);

  const work81 = new WorkBuilder()
    .multiInput<[number, [number, number]]>()
    .then('step2', async (a, [b, c]) => [a, b, c])
    .finish();
  const work8 = new WorkBuilder()
    .then('step1', async () => 42)
    .forkPass(p => p
      .thread('p1', async i => i * 10)
      .thread('p2', async i => i + 10))
    .thenWorkPass(work81)
    .then('step3', async (a, [b, c], is) => is.map(i => i + 2))
    .finishUntuple();

  const task8 = s.exec(work8);
  await nextLoop();
  expect(task8.task.get().result().getOk()).toStrictEqual([44, 422, 54]);
})