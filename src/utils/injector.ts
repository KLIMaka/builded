import { forEach, map } from "./collections";
import { DirecredGraph } from "./graph";
import { iter } from "./iter";

export type InstanceProvider<T> = (i: Injector) => Promise<T>;
export type Plugin<T> = { start: InstanceProvider<T>, stop: InstanceProvider<void> }
export class Dependency<T> { constructor(readonly name: string, readonly isVoid = false) { } }
export type SubModule = (module: Module) => void;

const STOP = async (i: Injector) => { };
export function provider<T>(start: InstanceProvider<T>): Plugin<T> { return { start, stop: STOP } }
export function instance<T>(value: T): Plugin<T> { return provider(async i => value) }
export function plugin(name: string) { return new Dependency(name, true) }

export interface Module {
  bind<T>(dependency: Dependency<T>, provider: Plugin<T>): void;
  install(submodule: SubModule): void;
}

export interface Injector {
  getInstance<T>(dependency: Dependency<T>): Promise<T>;
}

export interface Runtime extends Injector {
  stop(): Promise<void>;
  replaceInstance<T>(dependency: Dependency<T>, provider: Plugin<T>): Promise<void>;
}

interface ParentInjector extends Injector {
  getInstanceParent<T>(dependency: Dependency<T>, injector: Injector): Promise<T>;
}

class ChildInjector<T> implements ParentInjector {
  constructor(readonly dependency: Dependency<T>, readonly parent: ParentInjector) { }
  getInstanceParent<T>(dependency: Dependency<T>, injector: Injector): Promise<T> { return this.parent.getInstanceParent(dependency, injector) }
  getInstance<T>(dependency: Dependency<T>): Promise<T> { return this.parent.getInstanceParent(dependency, this) }
}


export class App implements Module {
  private plugins = new Map<Dependency<any>, Plugin<any>>();

  public bind<T>(dependency: Dependency<T>, plugin: Plugin<T>): void {
    const p = this.plugins.get(dependency);
    if (p != undefined) throw new Error(`Multiple bindings to dependency ${dependency.name}`);
    this.plugins.set(dependency, plugin);
  }

  public install(submodule: SubModule) {
    submodule(this);
  }

  public async start(): Promise<Runtime> {
    const injector = new RootInjector(this.plugins);
    await Promise.all(iter(this.plugins.entries()).filter(e => e[0].isVoid).map(e => injector.getInstance(e[0])).collect());
    return injector;
  }
}

function getDependencyChain(dependency: Dependency<any>, injector: Injector) {
  const chain = [dependency];
  let current = injector;
  while (current instanceof ChildInjector) {
    chain.unshift(current.dependency);
    current = current.parent;
  }
  return chain;
}

export const RUNTIME = new Dependency<Runtime>('Runtime');

class RootInjector implements ParentInjector, Runtime {
  private graph = new DirecredGraph<Dependency<any>>();
  private instances = new Map<Dependency<any>, Promise<any>>();

  constructor(private providers: Map<Dependency<any>, Plugin<any>>) {
    this.instances.set(RUNTIME, Promise.resolve(this));
  }

  async stop(): Promise<void> {
    await Promise.all([...map(this.graph.orderedAll(), d => this.providers.get(d).stop(this))]);
  }

  private add<T>(dependency: Dependency<T>, injector: Injector) {
    this.graph.addChain(getDependencyChain(dependency, injector));
    const cycle = this.graph.findCycle();
    if (cycle != null) throw new Error(`Found cycle: ${cycle.map(d => d.name)}`);
  }

  public getInstanceParent<T>(dependency: Dependency<T>, injector: ParentInjector): Promise<T> {
    this.add(dependency, injector);
    let instance = this.instances.get(dependency);
    if (instance == undefined) {
      instance = this.create(dependency, injector);
      this.instances.set(dependency, instance);
    }
    return instance;
  }

  public getInstance<T>(dependency: Dependency<T>): Promise<T> {
    return this.getInstanceParent(dependency, this);
  }

  public async replaceInstance<T>(dependency: Dependency<T>, provider: Plugin<T>): Promise<void> {
    const toStop = this.graph.orderedTo(dependency);
    await Promise.all([...map(toStop, d => this.providers.get(d).stop(this))]);
    forEach(toStop, d => { this.graph.remove(d); this.instances.delete(d) });
    this.providers.set(dependency, provider);
    await Promise.all(iter(toStop).filter(d => d.isVoid).map(d => this.getInstance(d)).collect());
  }

  private create<T>(dependency: Dependency<T>, parent: ParentInjector) {
    const provider = this.providers.get(dependency);
    if (provider == null) throw new Error(`No provider bound to ${dependency.name}`);
    const injector = new ChildInjector(dependency, parent);
    return provider.start(injector);
  }
}

type Dependencyfy<T> = { [P in keyof T]: Dependency<T[P]> };
export async function create<U, T extends any[]>(injector: Injector, ctr: { new(...args: T): U }, ...args: Dependencyfy<T>): Promise<U> {
  return new ctr(...<T>await getInstances(injector, ...args));
}

export async function getInstances<T extends any[]>(injector: Injector, ...args: Dependencyfy<T>): Promise<T> {
  return <T>await Promise.all(args.map(a => injector.getInstance(a)));
}