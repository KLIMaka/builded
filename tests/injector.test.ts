import { App, Dependency, Executable, Injector, simple } from "../src/utils/injector";
import { iter } from "../src/utils/iter";

interface Type {
  foo(arg: any): any;
}

const A = new Dependency<Type>('A');
const B = new Dependency<Type>('B');
const C = new Dependency<Type>('C');

class AProvider implements Executable<Type> {
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

class CProvider implements Executable<Type> {
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

test('injector test', async done => {
  const app = new App();
  app.bind(A, new AProvider());
  app.bind(B, simple(async i => { return { foo: arg => arg } }));
  app.bind(C, new CProvider());
  let expected = 42;
  app.execute({
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
  await app.start();

  expected = 43;
  await app.replaceInstance(B, simple(async i => { return { foo: arg => arg + 1 } }));
  done();
});

test('ciclic', async done => {
  expect.assertions(1);
  const app = new App();
  app.bind(A, new AProvider());
  app.bind(B, simple(async i => {
    const a = i.getInstance(A)
    return { foo: arg => arg }
  }));
  app.bind(C, new CProvider());
  app.execute(simple(async i => {
    try {
      const a = await i.getInstance(A)
    } catch (e) {
      expect(e).toStrictEqual(new Error('Found cycle: A,B'));
    }
  }));

  await app.start();
  done();
});