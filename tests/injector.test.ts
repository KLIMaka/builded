import { App, Dependency, getInstances, Injector, Plugin, provider } from "../src/utils/injector";
import { iter } from "../src/utils/iter";

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

test('injector test', async done => {
  const app = new App();
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
  done();
});

test('ciclic', async done => {
  expect.assertions(1);
  const app = new App();
  app.bind(A, new AProvider());
  app.bind(B, provider(async i => {
    const a = i.getInstance(A)
    return { foo: arg => arg }
  }));
  app.bind(C, new CProvider());
  app.bind(new Dependency('main', true), provider(async i => {
    try {
      const a = await i.getInstance(A)
    } catch (e) {
      expect(e).toStrictEqual(new Error('Found cycle: B,A'));
    }
  }));

  await app.start();
  done();
});

test('test', async done => {
  const app = new App();
  const log: string[] = [];
  const A = new Dependency<number>('A');
  const B = new Dependency<number>('B');
  const OP = new Dependency<number>('OP');

  let ref_a = 42;
  let ref_b = 12;
  let ref_op = ref_a + ref_b;

  app.bind(A, {
    start: async i => {
      log.push('A+');
      return ref_a;
    },
    stop: async i => {
      log.push('A-');
    }
  });
  app.bind(B, {
    start: async i => {
      log.push('B+');
      return ref_b;
    },
    stop: async i => {
      log.push('B-');
    }
  });
  app.bind(OP, {
    start: async i => {
      log.push('OP+');
      const [a, b] = await getInstances(i, A, B);
      return a + b;
    },
    stop: async i => {
      log.push('OP-');
    }
  });


  app.bind(new Dependency('Main', true), {
    start: async i => {
      log.push('Main+');
      const op = await i.getInstance(OP);
      expect(op).toEqual(ref_op);
    },
    stop: async i => {
      log.push('Main-');
    }
  });
  app.bind(new Dependency('Main1', true), {
    start: async i => {
      log.push('Main1+');
      const b = await i.getInstance(B);
      expect(b).toEqual(ref_b);
    },
    stop: async i => {
      log.push('Main1-');
    }
  });
  app.bind(new Dependency('Main2', true), {
    start: async i => {
      log.push('Main2+');
      const a = await i.getInstance(A);
      expect(a).toEqual(ref_a);
    },
    stop: async i => {
      log.push('Main2-');
    }
  });
  const runtime = await app.start();

  expect(log).toStrictEqual(['Main+', 'OP+', 'A+', 'B+', 'Main1+', 'Main2+']);

  ref_b = 11;
  ref_op = ref_a + ref_b;

  log.splice(0, log.length);
  await runtime.replaceInstance(B, {
    start: async i => {
      log.push('nB+');
      return ref_b;
    },
    stop: async i => {
      log.push('nB-');
    }
  });
  expect(log).toStrictEqual(['Main-', 'OP-', 'Main1-', 'B-', 'Main+', 'OP+', 'nB+', 'Main1+']);

  log.splice(0, log.length);
  await runtime.stop();
  expect(log).toStrictEqual(['Main-', 'Main2-', 'OP-', 'Main1-', 'A-', 'nB-']);

  done();
});