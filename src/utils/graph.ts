import { iter } from './iter';

export class DirecredGraph<T> {
  public nodes = new Map<T, Set<T>>();

  private ensureNode(label: T) {
    let deps = this.nodes.get(label);
    if (deps == undefined) {
      deps = new Set();
      this.nodes.set(label, deps);
    }
    return deps;
  }

  public add(from: T, to: T) {
    this.ensureNode(to)
    this.ensureNode(from).add(to);
  }

  public remove(n: T) {
    iter(this.nodes.get(n))
      .filter(d => iter(this.nodes)
        .filter(([k, v]) => k != n && v.has(d))
        .isEmpty())
      .forEach(d => this.remove(d));
    iter(this.nodes).forEach(([_, v]) => v.delete(n));
    this.nodes.delete(n);
  }

  public findCycle(): T[] {
    const colors = new Map<T, string>();
    const nodes = this.nodes;
    const paint = function (node: T): T[] {
      colors.set(node, 'gray');
      for (const child of nodes.get(node)) {
        const c = colors.get(child);
        if (c == undefined) {
          const cycle = paint(child);
          if (cycle != null) { cycle.unshift(child); return cycle; }
        } else if (c == 'gray') return [child];
      }
      colors.set(node, 'black');
      return null;
    }
    for (const node of this.nodes.keys()) {
      if (colors.has(node)) continue;
      const cycle = paint(node);
      if (cycle != null) return cycle;
    }
    return null;
  }
}
