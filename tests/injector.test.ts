import { App, Dependency, DependencyError, getInstances, Injector, LifecycleListener, Plugin, provider } from "../src/utils/injector";
import { iter } from "../src/utils/iter";
import { performance } from "perf_hooks";

class Listener implements LifecycleListener {
  constructor(public log: string[] = []) { }
  async start<T>(dep: Dependency<T>, promise: Promise<T>): Promise<T> { this.log.push(`${dep.name}+`); return await promise }
  async stop<T>(dep: Dependency<T>, promise: Promise<void>): Promise<void> { this.log.push(`${dep.name}-`); return await promise }
}

interface Type {
  foo(arg: any): any;
}

const A = new Dependency<Type>('A');
const B = new Dependency<Type>('B');
const C = new Dependency<Type>('C');

class AProvider implements Plugin<Type> {
  private ptr = 0;

  async start(injector: Injector): Promise<Type> {
    const b = await injector.getInstance(B);
    const c = await injector.getInstance(C);
    this.ptr = c.foo('A');
    return {
      foo: arg => b.foo(arg)
    };
  }

  async stop(injector: Injector): Promise<void> {
    const c = await injector.getInstance(C);
    c.foo(this.ptr);
  }
}

class CProvider implements Plugin<Type> {
  private registered = [];
  private ptr = 0;

  async start(injector: Injector): Promise<Type> {
    return {
      foo: arg => {
        if (arg == null) return [...iter(this.registered).filter(a => a != null)];
        if (typeof arg == 'string') {
          const idx = this.ptr++;
          this.registered.push(arg);
          return idx;
        } else {
          this.registered[arg] = null;
        }
      }
    }
  }

  async stop(injector: Injector): Promise<void> { }
}

test('injector test', async () => {
  const listener = new Listener();
  const app = new App(listener);
  app.bind(A, new AProvider());
  app.bind(B, provider(async i => { return { foo: arg => arg } }));
  app.bind(C, new CProvider());
  let expected = 42;
  app.bind(new Dependency('main', true), {
    start: async injector => {
      const a = await injector.getInstance(A);
      const c = await injector.getInstance(C);
      expect(c.foo(null)).toStrictEqual(['A']);
      expect(a.foo(42)).toBe(expected);
      c.foo('1');
      c.foo('2');
      expect(c.foo(null)).toStrictEqual(['A', '1', '2']);
    },
    stop: async injector => {
      const c = await injector.getInstance(C);
      c.foo(1);
      c.foo(2);
    }
  });
  const runtime = await app.start();

  expected = 43;
  await runtime.replaceInstance(B, provider(async i => { return { foo: arg => arg + 1 } }));
  expect(listener.log).toStrictEqual(['B+', 'A+', 'main+', 'Runtime+', 'C+', 'main-', 'A-', 'B-', 'B+', 'A+', 'main+']);
});

test('cyclic', async () => {
  const app = new App();
  app.bind(A, new AProvider());
  app.bind(B, provider(async i => {
    const a = i.getInstance(A)
    return { foo: arg => arg }
  }));
  app.bind(C, new CProvider());
  app.bind(new Dependency('main', true), provider(async i => {
    const a = await i.getInstance(A)
  }));

  try {
    await app.start();
  } catch (e) {
    expect(e instanceof DependencyError).toBeTruthy();
    let de = <DependencyError>e;
    expect(de.message).toBe('Error while starting App');
    expect(de.cause.message).toBe('Error while creating main');
    de = <DependencyError>de.cause;
    expect(de.cause.message).toBe('Error while creating A');
    de = <DependencyError>de.cause;
    expect(de.cause.message).toBe('Error while creating B');
    de = <DependencyError>de.cause;
    expect(de.cause.message).toBe('Found cycle: B,A');
  }
});

test('test', async () => {
  const listener = new Listener();
  const app = new App(listener);
  const A = new Dependency<number>('A');
  const B = new Dependency<number>('B');
  const OP = new Dependency<number>('OP');

  let ref_a = 42;
  let ref_b = 12;
  let ref_op = ref_a + ref_b;

  app.bind(A, provider(async (i: Injector) => ref_a));
  app.bind(B, provider(async (i: Injector) => ref_b));
  app.bind(OP, provider(async (i: Injector) => {
    const [a, b] = await getInstances(i, A, B);
    return a + b;
  }));


  app.bind(new Dependency('Main', true), provider(async (i: Injector) => {
    const op = await i.getInstance(OP);
    expect(op).toEqual(ref_op);
  }));
  app.bind(new Dependency('Main1', true), provider(async (i: Injector) => {
    const b = await i.getInstance(B);
    expect(b).toEqual(ref_b);
  }));
  app.bind(new Dependency('Main2', true), provider(async (i: Injector) => {
    const a = await i.getInstance(A);
    expect(a).toEqual(ref_a);
  }));
  const runtime = await app.start();

  expect(listener.log).toStrictEqual(['A+', 'B+', 'OP+', 'Main+', 'Main1+', 'Main2+', 'Runtime+']);

  ref_b = 11;
  ref_op = ref_a + ref_b;

  listener.log = [];

  await runtime.replaceInstance(B, provider(async (i: Injector) => ref_b));
  expect(listener.log).toStrictEqual(['Main-', 'OP-', 'Main1-', 'B-', 'B+', 'OP+', 'Main+', 'Main1+']);

  listener.log = [];

  await runtime.stop();
  expect(listener.log).toStrictEqual(['Main-', 'Main2-', 'OP-', 'Main1-', 'A-', 'B-']);
});