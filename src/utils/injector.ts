
export class Dependency<T> { constructor(readonly name: string, readonly multi = false) { } }

export type InstanceProvider<T> = (injector: Injector) => Promise<T>;

export class CircularDependencyError extends Error {
  constructor(readonly dependencies: string[]) { super() }
  get message() { return 'Circular dependency detected while trying to resolve ' + this.dependencies.join(' -> ') }
  name = 'CircularDependencyError'
  stack = super.stack
}

export interface Injector {
  getInstance<T>(dependency: Dependency<T>): Promise<T>;
  bind<T>(dependency: Dependency<T | T[]>, provider: InstanceProvider<T>): void;
  bindInstance<T>(dependency: Dependency<T>, instance: T): void;
  install(module: (injector: Injector) => void): void;
}

interface ParentInjector extends Injector {
  getInstanceParent<T>(dependency: Dependency<T>, injector: Injector): Promise<T>;
}

class ChildInjector<T> implements ParentInjector {
  constructor(readonly dependency: Dependency<T>, readonly parent: ParentInjector) { }
  getInstanceParent<T>(dependency: Dependency<T>, injector: Injector): Promise<T> { return this.parent.getInstanceParent(dependency, injector) }
  getInstance<T>(dependency: Dependency<T>): Promise<T> { return this.parent.getInstanceParent(dependency, this) }
  bind<T>(dependency: Dependency<T | T[]>, provider: InstanceProvider<T>): void { this.parent.bind(dependency, provider) }
  bindInstance<T>(dependency: Dependency<T>, instance: T): void { this.parent.bindInstance(dependency, instance) }
  install(module: (injector: Injector) => void): void { this.parent.install(module) }
}

class DependencyNode {
  readonly dependencies = new Set<DependencyNode>();
  constructor(readonly label: string) { };
}

class Graph {
  private nodes = new Map<string, DependencyNode>();

  private ensureNode(label: string) {
    let node = this.nodes.get(label);
    if (node == undefined) {
      node = new DependencyNode(label);
      this.nodes.set(label, node);
    }
    return node;
  }

  public add(o: string, i: string) {
    this.ensureNode(o).dependencies.add(this.ensureNode(i));
  }

  public checkCycles() {
    const colors = new Map<string, string>();
    const paint = function (node: DependencyNode) {
      colors.set(node.label, 'gray');
      for (const child of node.dependencies) {
        const c = colors.get(child.label);
        if (c == undefined) {
          try { paint(child) } catch (e) {
            if (e instanceof CircularDependencyError) e.dependencies.unshift(child.label);
            throw e;
          }
        }
        else if (c == 'gray') throw new CircularDependencyError([child.label]);
      }
      colors.set(node.label, 'black');
    }
    for (const [label, node] of this.nodes) {
      if (colors.has(label)) continue;
      paint(node);
    }
  }
}


export class RootInjector implements ParentInjector {
  private providers = new Map<Dependency<any>, InstanceProvider<any>[]>();
  private promises = new Map<Dependency<any>, Promise<any>>();
  private graph: Graph = new Graph();

  private add<T>(dependency: Dependency<T>, injector: Injector) {
    const chain = [dependency.name];
    let current = injector;
    while (current instanceof ChildInjector) {
      chain.unshift(current.dependency.name);
      current = current.parent;
    }
    for (let i = 0; i < chain.length - 1; i++) this.graph.add(chain[i], chain[i + 1]);
    this.graph.checkCycles();
  }

  public getInstanceParent<T>(dependency: Dependency<T>, injector: ParentInjector): Promise<T> {
    this.add(dependency, injector);
    let instance = this.promises.get(dependency);
    if (instance == undefined) {
      instance = this.create(dependency, injector);
      this.promises.set(dependency, instance);
    }
    return instance;
  }

  public getInstance<T>(dependency: Dependency<T>): Promise<T> {
    return this.getInstanceParent(dependency, this);
  }

  public bind<T>(dependency: Dependency<T | T[]>, provider: InstanceProvider<T>): void {
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

  private create<T>(dependency: Dependency<T>, parent: ParentInjector) {
    const provider = this.providers.get(dependency);
    if (provider == null) throw new Error(`No provider bound to ${dependency.name}`);
    const injector = new ChildInjector(dependency, parent);
    return dependency.multi
      ? Promise.all(provider.map(p => p(injector)))
      : provider[0](injector);
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