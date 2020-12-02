import { enumerate } from "./collections";

export class Dependency<T> { constructor(readonly name: string) { } }
export type InstanceProvider<T> = (injector: Injector) => Promise<T>;
export type Executable = (injector: Injector) => Promise<void>;
export type SubModule = (module: Module) => void;

export class CircularDependencyError extends Error {
  constructor(readonly dependencies: string[]) { super() }
  get message() { return 'Circular dependency detected while trying to resolve ' + this.dependencies.join(' -> ') }
  name = 'CircularDependencyError'
  stack = super.stack
}

export interface Module {
  bind<T>(dependency: Dependency<T>, provider: InstanceProvider<T>): void;
  bindInstance<T>(dependency: Dependency<T>, instance: T): void;
  install(submodule: SubModule): void;
  execute(executable: Executable): void;
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

class Graph {
  private nodes = new Map<string, Set<string>>();

  private ensureNode(label: string) {
    let deps = this.nodes.get(label);
    if (deps == undefined) {
      deps = new Set();
      this.nodes.set(label, deps);
    }
    return deps;
  }

  public add(o: string, i: string) {
    this.ensureNode(o)
    this.ensureNode(i).add(o);
  }

  public checkCycles() {
    const colors = new Map<string, string>();
    const nodes = this.nodes;
    const paint = function (node: string) {
      colors.set(node, 'gray');
      for (const child of nodes.get(node)) {
        const c = colors.get(child);
        if (c == undefined) {
          try { paint(child) } catch (e) {
            if (e instanceof CircularDependencyError) e.dependencies.unshift(child);
            throw e;
          }
        }
        else if (c == 'gray') throw new CircularDependencyError([child]);
      }
      colors.set(node, 'black');
    }
    for (const node of this.nodes.keys()) {
      if (colors.has(node)) continue;
      paint(node);
    }
  }
}

export class App implements Module {
  private providers = new Map<Dependency<any>, InstanceProvider<any>>();
  private promises = new Map<Dependency<any>, Promise<any>>();
  private executables: Executable[] = [];

  public bind<T>(dependency: Dependency<T>, provider: InstanceProvider<T>): void {
    let p = this.providers.get(dependency);
    if (p != undefined) throw new Error(`Multiple bindings to dependency ${dependency.name}`);
    this.providers.set(dependency, provider);
  }

  public bindInstance<T>(dependency: Dependency<T>, instance: T) {
    this.promises.set(dependency, Promise.resolve(instance));
  }

  public install(submodule: SubModule) {
    submodule(this);
  }

  public execute(executable: Executable): void {
    this.executables.push(executable);
  }

  public async start() {
    const injector = new RootInjector(this.providers, this.promises);
    const results = [];
    for (const e of this.executables) results.push(e(injector));
    await Promise.all(results);
  }
}


class RootInjector implements ParentInjector {
  private graph: Graph = new Graph();

  constructor(
    private providers: Map<Dependency<any>, InstanceProvider<any>>,
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
    return provider(injector);
  }
}

type Dependencyfy<T> = { [P in keyof T]: Dependency<T[P]> };
export async function create<U, T extends any[]>(injector: Injector, ctr: { new(...args: T): U }, ...args: Dependencyfy<T>): Promise<U> {
  return new ctr(...<T>await Promise.all(args.map(a => injector.getInstance(a))));
}

export async function getInstances<T extends any[]>(injector: Injector, ...args: Dependencyfy<T>): Promise<T> {
  return <T>await Promise.all(args.map(a => injector.getInstance(a)));
}