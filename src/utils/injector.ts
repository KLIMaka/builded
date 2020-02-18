
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

  public bindMulti<T>(dependency: Dependency<T[]>, provider: InstanceProvider<T>) {
    this.bind(<Dependency<T>>dependency, provider);
  }

  public bind<T>(dependency: Dependency<T>, provider: InstanceProvider<T>) {
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

  public bindPromise<T>(dependency: Dependency<T>, promise: Promise<T>) {
    this.promises.set(dependency, promise);
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