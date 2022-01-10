import { getOrCreate, map } from "./collections";
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


export type Lifecycle = <T>(value: T, cleaner: (value: T) => Promise<void>) => T;
export function lifecycle<T>(start: (i: Injector, lifecycle: Lifecycle) => Promise<T>): Plugin<T> {
  const cleaners: [any, (v: any) => Promise<void>][] = [];
  const lifecycle = <T1>(value: T1, cleaner: (value: T1) => Promise<void>) => { cleaners.push([value, cleaner]); return value }
  return {
    async start(i: Injector) { return start(i, lifecycle) },
    async stop(i: Injector) { await Promise.all(iter(cleaners.reverse()).map(c => c[1](c[0])).collect()) }
  }
}

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

export type Timer = () => number;

export class App implements Module {
  private plugins = new Map<Dependency<any>, Plugin<any>>();

  constructor(private timer: Timer) { }

  public bind<T>(dependency: Dependency<T>, plugin: Plugin<T>): void {
    if (this.plugins.has(dependency)) throw new Error(`Multiple bindings to dependency ${dependency.name}`);
    this.plugins.set(dependency, plugin);
  }

  public install(submodule: SubModule) {
    submodule(this);
  }

  public async start(): Promise<Runtime> {
    const injector = new RootInjector(this.plugins, this.timer);
    try {
      const start = this.timer();
      const voidDeps = iter(this.plugins.keys())
        .filter(dep => dep.isVoid)
        .map(dep => injector.getInstance(dep))
        .collect();
      await Promise.all(voidDeps);
      console.info(`App started in ${(this.timer() - start).toFixed(2)}ms`);
      return injector;
    } catch (e) {
      console.error(`Error while starting App. ${e}\n${e.stack}`);
      throw e;
    }
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

  constructor(private providers: Map<Dependency<any>, Plugin<any>>, private timer: Timer) {
    this.instances.set(RUNTIME, Promise.resolve(this));
  }

  async stop(): Promise<void> {
    await Promise.all([...map(this.graph.orderedAll(), d => this.stopInstance(d))]);
  }

  private add<T>(dependency: Dependency<T>, injector: Injector) {
    this.graph.addChain(getDependencyChain(dependency, injector));
    const cycle = this.graph.findCycle();
    if (cycle != null) throw new Error(`Found cycle: ${cycle.map(d => d.name)}`);
  }

  public getInstanceParent<T>(dependency: Dependency<T>, injector: ParentInjector): Promise<T> {
    this.add(dependency, injector);
    return getOrCreate(this.instances, dependency, d => this.create(d, injector));
  }

  public getInstance<T>(dependency: Dependency<T>): Promise<T> {
    return this.getInstanceParent(dependency, this);
  }

  public async replaceInstance<T>(dependency: Dependency<T>, provider: Plugin<T>): Promise<void> {
    const toStop = this.graph.orderedTo(dependency);
    await Promise.all([...map(toStop, d => this.stopInstance(d))]);
    this.providers.set(dependency, provider);
    await Promise.all(iter(toStop).filter(d => d.isVoid).map(d => this.getInstance(d)).collect());
  }

  private async create<T>(dependency: Dependency<T>, parent: ParentInjector) {
    const provider = this.providers.get(dependency);
    if (provider == undefined) throw new Error(`No provider bound to ${dependency.name}`);
    const injector = new ChildInjector(dependency, parent);
    try {
      const start = this.timer();
      const instance = await provider.start(injector);
      console.info(`${dependency.name} started in ${(this.timer() - start).toFixed(2)}ms`);
      return instance;
    } catch (error) {
      console.error(`Error while creating ${dependency.name}. ${error}\n${error.stack}`);
      throw error;
    }
  }

  private async stopInstance<T>(dependency: Dependency<T>) {
    try {
      const start = this.timer();
      await this.providers.get(dependency).stop(this);
      this.graph.remove(dependency);
      this.instances.delete(dependency);
      console.info(`${dependency.name} stopped in ${(this.timer() - start).toFixed(2)}ms`);
    } catch (error) {
      console.error(`Error while stopping ${dependency.name}. ${error}\n${error.stack}`);
      throw error;
    }
  }
}

type Dependencyfy<T> = { [P in keyof T]: Dependency<T[P]> };
export async function create<U, T extends any[]>(injector: Injector, ctr: { new(...args: T): U }, ...args: Dependencyfy<T>): Promise<U> {
  return new ctr(...<T>await getInstances(injector, ...args));
}

export async function getInstances<T extends any[]>(injector: Injector, ...args: Dependencyfy<T>): Promise<T> {
  return <T>await Promise.all(args.map(a => injector.getInstance(a)));
}