
export class Dependency<T> { constructor(readonly name: string, readonly multi = false) { } }

export type InstanceProvider<T> = (injector: Injector) => Promise<T>;

export class CircularDependencyError extends Error {
  constructor(readonly dependencies: Dependency<any>[]) { super() }
  get message() { return 'Circular dependency detected while trying to resolve ' + this.dependencies.map(d => d.name).join(' -> ') }
  name = 'CircularDependencyError'
  stack = super.stack
}

export class Injector {
  private providers = new Map<Dependency<any>, InstanceProvider<any>[]>();
  private promises = new Map<Dependency<any>, Promise<any>>();
  private resolving = new Set<Dependency<any>>();

  public getInstance<T>(dependency: Dependency<T>): Promise<T> {
    if (this.resolving.has(dependency)) throw new CircularDependencyError([dependency]);
    let instance = this.promises.get(dependency);
    if (instance == undefined) {
      this.resolving.add(dependency);
      instance = this.create(dependency);
      this.promises.set(dependency, instance);
      this.resolving.delete(dependency);
    }
    return instance;
  }

  public getProvider<T>(dependency: Dependency<T>): () => Promise<T> {
    return () => this.promises.get(dependency);
  }

  public bind<T>(dependency: Dependency<T>, provider: InstanceProvider<T>): void
  public bind<T>(dependency: Dependency<T[]>, provider: InstanceProvider<T>): void {
    let p = this.providers.get(dependency);
    if (dependency.multi) {
      if (p == undefined) {
        p = [];
        this.providers.set(dependency, p);
      }
      p.push(provider);
    } else {
      if (p != undefined) throw new Error(`Multiple bindings to dependency ${dependency.name}`);
      this.providers.set(dependency, [provider]);
    }
  }

  public bindInstance<T>(dependency: Dependency<T>, instance: T) {
    this.promises.set(dependency, Promise.resolve(instance));
  }

  public install(module: (injector: Injector) => void) {
    module(this);
  }

  private create<T>(dependency: Dependency<T>) {
    const provider = this.providers.get(dependency);
    if (provider == null) throw new Error(`No provider bound to ${dependency.name}`);
    return dependency.multi
      ? Promise.all(provider.map(p => p(this)))
      : provider[0](this);
  }
}

export async function create<T, D1, D2, D3, D4, D5, D6, D7>(i: Injector, ctr: { new(d1: D1, d2?: D2, d3?: D3, d4?: D4, d5?: D5, d6?: D6, d7?: D7): T },
  d1: Dependency<D1>, d2?: Dependency<D2>, d3?: Dependency<D3>, d4?: Dependency<D4>, d5?: Dependency<D5>, d6?: Dependency<D6>, d7?: Dependency<D7>): Promise<T> {
  if (d7 != undefined) return create7(i, ctr, d1, d2, d3, d4, d5, d6, d7);
  if (d6 != undefined) return create6(i, ctr, d1, d2, d3, d4, d5, d6);
  if (d5 != undefined) return create5(i, ctr, d1, d2, d3, d4, d5);
  if (d4 != undefined) return create4(i, ctr, d1, d2, d3, d4);
  if (d3 != undefined) return create3(i, ctr, d1, d2, d3);
  if (d2 != undefined) return create2(i, ctr, d1, d2);
  if (d1 != undefined) return create1(i, ctr, d1);
  throw new Error('Invalid create usage');
}

async function create7<T, D1, D2, D3, D4, D5, D6, D7>(i: Injector, ctr: { new(d1: D1, d2: D2, d3: D3, d4: D4, d5: D5, d6: D6, d7: D7): T },
  d1: Dependency<D1>, d2: Dependency<D2>, d3: Dependency<D3>, d4: Dependency<D4>, d5: Dependency<D5>, d6: Dependency<D6>, d7: Dependency<D7>): Promise<T> {
  const [i1, i2, i3, i4, i5, i6, i7] = await Promise.all([
    i.getInstance(d1),
    i.getInstance(d2),
    i.getInstance(d3),
    i.getInstance(d4),
    i.getInstance(d5),
    i.getInstance(d6),
    i.getInstance(d7),
  ]);
  return new ctr(i1, i2, i3, i4, i5, i6, i7);
}

async function create6<T, D1, D2, D3, D4, D5, D6>(i: Injector, ctr: { new(d1: D1, d2: D2, d3: D3, d4: D4, d5: D5, d6: D6): T },
  d1: Dependency<D1>, d2: Dependency<D2>, d3: Dependency<D3>, d4: Dependency<D4>, d5: Dependency<D5>, d6: Dependency<D6>): Promise<T> {
  const [i1, i2, i3, i4, i5, i6] = await Promise.all([
    i.getInstance(d1),
    i.getInstance(d2),
    i.getInstance(d3),
    i.getInstance(d4),
    i.getInstance(d5),
    i.getInstance(d6),
  ]);
  return new ctr(i1, i2, i3, i4, i5, i6);
}

async function create5<T, D1, D2, D3, D4, D5>(i: Injector, ctr: { new(d1: D1, d2: D2, d3: D3, d4: D4, d5: D5): T },
  d1: Dependency<D1>, d2: Dependency<D2>, d3: Dependency<D3>, d4: Dependency<D4>, d5: Dependency<D5>): Promise<T> {
  const [i1, i2, i3, i4, i5] = await Promise.all([
    i.getInstance(d1),
    i.getInstance(d2),
    i.getInstance(d3),
    i.getInstance(d4),
    i.getInstance(d5),
  ]);
  return new ctr(i1, i2, i3, i4, i5);
}

async function create4<T, D1, D2, D3, D4>(i: Injector, ctr: { new(d1: D1, d2: D2, d3: D3, d4: D4): T },
  d1: Dependency<D1>, d2: Dependency<D2>, d3: Dependency<D3>, d4: Dependency<D4>): Promise<T> {
  const [i1, i2, i3, i4] = await Promise.all([
    i.getInstance(d1),
    i.getInstance(d2),
    i.getInstance(d3),
    i.getInstance(d4),
  ]);
  return new ctr(i1, i2, i3, i4);
}

async function create3<T, D1, D2, D3>(i: Injector, ctr: { new(d1: D1, d2: D2, d3: D3): T },
  d1: Dependency<D1>, d2: Dependency<D2>, d3: Dependency<D3>): Promise<T> {
  const [i1, i2, i3] = await Promise.all([
    i.getInstance(d1),
    i.getInstance(d2),
    i.getInstance(d3),
  ]);
  return new ctr(i1, i2, i3);
}

async function create2<T, D1, D2>(i: Injector, ctr: { new(d1: D1, d2: D2): T },
  d1: Dependency<D1>, d2: Dependency<D2>): Promise<T> {
  const [i1, i2] = await Promise.all([
    i.getInstance(d1),
    i.getInstance(d2),
  ]);
  return new ctr(i1, i2);
}

async function create1<T, D1>(i: Injector, ctr: { new(d1: D1): T },
  d1: Dependency<D1>): Promise<T> {
  const i1 = await i.getInstance(d1);
  return new ctr(i1);
}