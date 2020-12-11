import { map } from "./collections";
import { DirecredGraph } from "./graph";
import { iter } from "./iter";

export interface Executable<T> {
  start(injector: Injector): Promise<T>;
  stop(injector: Injector): Promise<void>;
}
export class Dependency<T> { constructor(readonly name: string) { } }
export type SubModule = (module: Module) => void;

export function simple<T>(start: (injector: Injector) => Promise<T>): Executable<T> {
  return { start, stop: async (injector: Injector) => { } }
}

export interface Module {
  bind<T>(dependency: Dependency<T>, provider: Executable<T>): void;
  bindInstance<T>(dependency: Dependency<T>, instance: T): void;
  install(submodule: SubModule): void;
  execute(executable: Executable<void>): void;
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


type ExecutableDependency = { exec: Executable<any>, dependsOn: (d: Dependency<any>) => boolean };

export class App implements Module {
  private providers = new Map<Dependency<any>, Executable<any>>();
  private promises = new Map<Dependency<any>, Promise<any>>();
  private executables: ExecutableDependency[] = [];
  private injector: RootInjector;

  public bind<T>(dependency: Dependency<T>, provider: Executable<T>): void {
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

  public execute(executable: Executable<void>): void {
    this.executables.push({ exec: executable, dependsOn: null });
  }

  private refreshExecutable(ed: ExecutableDependency) {
    const i = this.injector.getInjector();
    ed.dependsOn = i.dependsOn;
    return ed.exec.start(i);
  }

  public async start() {
    this.injector = new RootInjector(this.providers, this.promises);
    const results = [];
    for (const e of this.executables) results.push(this.refreshExecutable(e))
    await Promise.all(results);
  }

  public async replaceInstance<T>(dependency: Dependency<T>, provider: Executable<T>): Promise<void> {
    const toRefresh = iter(this.executables).filter(e => e.dependsOn(dependency)).collect();
    await Promise.all([...map(toRefresh, d => d.exec.stop(this.injector))]);
    await this.injector.replaceInstance(dependency, provider);
    await Promise.all([...map(toRefresh, d => this.refreshExecutable(d))]);
  }
}


class RootInjector implements ParentInjector {
  private graph = new DirecredGraph<Dependency<any>>();

  constructor(
    private providers: Map<Dependency<any>, Executable<any>>,
    private promises: Map<Dependency<any>, Promise<any>>
  ) { }

  private add<T>(dependency: Dependency<T>, injector: Injector) {
    const chain = [dependency];
    let current = injector;
    while (current instanceof ChildInjector) {
      chain.unshift(current.dependency);
      current = current.parent;
    }
    for (let i = 0; i < chain.length - 1; i++) this.graph.add(chain[i], chain[i + 1]);
    const cycle = this.graph.findCycle();
    if (cycle != null) throw new Error(`Found cycle: ${cycle.map(d => d.name)}`);
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

  public async replaceInstance<T>(dependency: Dependency<T>, provider: Executable<T>): Promise<void> {
    const dependant = [...iter(this.graph.nodes).filter(([_, v]) => v.has(dependency)).map(([k, _]) => k)];
    await Promise.all([...map(dependant, d => this.providers.get(d).stop(this))]);
    this.graph.remove(dependency);
    this.providers.set(dependency, provider);
    const newInstance = this.create(dependency, this);
    this.promises.set(dependency, newInstance);
    await Promise.all([...map(dependant, d => this.replaceInstance(d, this.providers.get(d)))]);
  }

  private create<T>(dependency: Dependency<T>, parent: ParentInjector) {
    const provider = this.providers.get(dependency);
    if (provider == null) throw new Error(`No provider bound to ${dependency.name}`);
    const injector = new ChildInjector(dependency, parent);
    return provider.start(injector);
  }

  public allDependencies(dependency: Dependency<any>): Set<Dependency<any>> {
    const deps = [...this.graph.nodes.get(dependency)];
    for (let i = 0; i < deps.length; i++) {
      const dep = deps[i];
      for (const d of this.graph.nodes.get(dep))
        if (deps.indexOf(d) == -1) deps.push(d);
    }
    return new Set(deps);
  }

  public getInjector(): Injector & { dependsOn: (d: Dependency<any>) => boolean } {
    const directDeps = new Set<Dependency<any>>();
    const getInstance = (d: Dependency<any>) => { directDeps.add(d); return this.getInstance(d); }
    return { getInstance, dependsOn: d => this.dependsOn(directDeps, d) }
  }

  private dependsOn(directDeps: Set<Dependency<any>>, d: Dependency<any>): boolean {
    if (directDeps.has(d)) return true;
    for (const dd of directDeps) {
      const depends = this.dependsOn(this.graph.nodes.get(dd), d);
      if (depends) return true;
    }
    return false;
  }
}

type Dependencyfy<T> = { [P in keyof T]: Dependency<T[P]> };
export async function create<U, T extends any[]>(injector: Injector, ctr: { new(...args: T): U }, ...args: Dependencyfy<T>): Promise<U> {
  return new ctr(...<T>await getInstances(injector, ...args));
}

export async function getInstances<T extends any[]>(injector: Injector, ...args: Dependencyfy<T>): Promise<T> {
  return <T>await Promise.all(args.map(a => injector.getInstance(a)));
}