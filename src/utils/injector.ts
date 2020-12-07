import { DirecredGraph } from "./graph";
import { iter } from "./iter";

export class Dependency<T> { constructor(readonly name: string) { } }
export type InstanceProvider<T> = (injector: Injector) => Promise<T>;
export type Executable = (injector: Injector) => Promise<void>;
export type SubModule = (module: Module) => void;

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


type ExecutableDependency = { exec: Executable, dependenies: Set<Dependency<any>> };

export class App implements Module {
  private providers = new Map<Dependency<any>, InstanceProvider<any>>();
  private promises = new Map<Dependency<any>, Promise<any>>();
  private executables: ExecutableDependency[] = [];
  private injector: RootInjector;

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
    this.executables.push({ exec: executable, dependenies: null });
  }

  private refreshExecutable(ed: ExecutableDependency) {
    const i = this.injector.getInjector();
    ed.dependenies = i.dependencies;
    return ed.exec(i);
  }

  public async start() {
    this.injector = new RootInjector(this.providers, this.promises);
    const results = [];
    for (const e of this.executables) results.push(this.refreshExecutable(e))
    await Promise.all(results);
  }
}


class RootInjector implements ParentInjector {
  private graph = new DirecredGraph<Dependency<any>>();

  constructor(
    private providers: Map<Dependency<any>, InstanceProvider<any>>,
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
    if (cycle != null) throw new Error(`Found cycle: ${cycle}`);
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

  public replaceInstance<T>(dependency: Dependency<T>, provider: InstanceProvider<T>): Promise<void> {
    this.providers.set(dependency, provider);
    const dependant = [...iter(this.graph.nodes).filter(([_, v]) => v.has(dependency)).map(([k, _]) => k)];
    this.graph.remove(dependency);
    const newInstance = this.create(dependency, this);
    dependant.forEach(d => this.replaceInstance(d, this.providers.get(d)));
    return newInstance;
  }

  private create<T>(dependency: Dependency<T>, parent: ParentInjector) {
    const provider = this.providers.get(dependency);
    if (provider == null) throw new Error(`No provider bound to ${dependency.name}`);
    const injector = new ChildInjector(dependency, parent);
    return provider(injector);
  }

  public getInjector(): Injector & { dependencies: Set<Dependency<any>> } {
    const dependencies = new Set<Dependency<any>>();
    const getInstance = (d: Dependency<any>) => { dependencies.add(d); return this.getInstance(d); }
    return { getInstance, dependencies }
  }
}

type Dependencyfy<T> = { [P in keyof T]: Dependency<T[P]> };
export async function create<U, T extends any[]>(injector: Injector, ctr: { new(...args: T): U }, ...args: Dependencyfy<T>): Promise<U> {
  return new ctr(...<T>await Promise.all(args.map(a => injector.getInstance(a))));
}

export async function getInstances<T extends any[]>(injector: Injector, ...args: Dependencyfy<T>): Promise<T> {
  return <T>await Promise.all(args.map(a => injector.getInstance(a)));
}