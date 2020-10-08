
export class Dependency<T> { constructor(readonly name: string, readonly multi = false) { } }
export type InstanceProvider<T> = (injector: Injector) => Promise<T>;
export type SubModule = (module: Module) => void;

export class CircularDependencyError extends Error {
  constructor(readonly dependencies: string[]) { super() }
  get message() { return 'Circular dependency detected while trying to resolve ' + this.dependencies.join(' -> ') }
  name = 'CircularDependencyError'
  stack = super.stack
}

export interface Module {
  bind<T>(dependency: Dependency<T | T[]>, provider: InstanceProvider<T>): void;
  bindInstance<T>(dependency: Dependency<T>, instance: T): void;
  install(submodule: SubModule): void;
  execute(executable: (injector: Injector) => void): void;
}

export interface Injector {
  getInstance<T>(dependency: Dependency<T>): Promise<T>;
}

interface ParentInjector extends Injector {
  getInstanceParent<T>(dependency: Dependency<T>, injector: Injector): Promise<T>;
}

class ChildInjector<T> implements ParentInjector {
  constructor(readonly dependency: Dependency<T>, readonly parent: ParentInjector) { }
  getInstanceParent<T>(dependency: Dependency<T>, injector: Injector): Promise<T> { return this.parent.getInstanceParent(dependency, injector) }
  getInstance<T>(dependency: Dependency<T>): Promise<T> { return this.parent.getInstanceParent(dependency, this) }
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

export class RootModule implements Module {
  private providers = new Map<Dependency<any>, InstanceProvider<any>[]>();
  private promises = new Map<Dependency<any>, Promise<any>>();
  private executables: ((injector: Injector) => void)[] = [];

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

  public install(submodule: SubModule) {
    submodule(this);
  }

  execute(executable: (injector: Injector) => void): void {
    this.executables.push(executable);
  }

  public start() {
    const injector = new RootInjector(this.providers, this.promises);
    for (const e of this.executables) e(injector);
  }
}


class RootInjector implements ParentInjector {
  private graph: Graph = new Graph();

  constructor(
    private providers: Map<Dependency<any>, InstanceProvider<any>[]>,
    private promises: Map<Dependency<any>, Promise<any>>
  ) { }

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

  private create<T>(dependency: Dependency<T>, parent: ParentInjector) {
    const provider = this.providers.get(dependency);
    if (provider == null) throw new Error(`No provider bound to ${dependency.name}`);
    const injector = new ChildInjector(dependency, parent);
    return dependency.multi
      ? Promise.all(provider.map(p => p(injector)))
      : provider[0](injector);
  }
}

type Dependencyfy<T> = { [P in keyof T]: Dependency<T[P]> };
export async function create<U, T extends any[]>(injector: Injector, ctr: { new(...args: T): U }, ...args: Dependencyfy<T>): Promise<U> {
  return new ctr(...<T>await Promise.all(args.map(a => injector.getInstance(a))));
}

export async function getInstances<T extends any[]>(injector: Injector, ...args: Dependencyfy<T>): Promise<T> {
  return <T>await Promise.all(args.map(a => injector.getInstance(a)));
}