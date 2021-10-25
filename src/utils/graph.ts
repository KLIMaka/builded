import { forEach } from './collections';
import { iter } from './iter';
import { memoize } from './mathutils';

export class DirecredGraph<T> {
  readonly nodes = new Map<T, Set<T>>();

  private ensureNode(label: T) {
    let links = this.nodes.get(label);
    if (links == undefined) {
      links = new Set();
      this.nodes.set(label, links);
    }
    return links;
  }

  public add(from: T, to: T) {
    this.ensureNode(to)
    this.ensureNode(from).add(to);
  }

  public addChain(chain: T[]) {
    for (let i = 0; i < chain.length - 1; i++)
      this.add(chain[i], chain[i + 1]);
  }

  public remove(n: T) {
    forEach(this.nodes.entries(), e => e[1].delete(n));
    this.nodes.delete(n);
  }

  public order(node: T): number {
    const links = this.nodes.get(node);
    if (links.size == 0) return 0;
    let maxorder = 0;
    for (const l of links) maxorder = Math.max(this.order(l), maxorder);
    return maxorder + 1;
  }

  public orderedTo(node: T) {
    const result = new Set<T>();
    result.add(node);
    for (const n of result)
      iter(this.nodes.entries()).filter(([_, value]) => value.has(n)).map(([key, _]) => key).forEach(e => result.add(e));
    const order = memoize((n: T) => this.order(n));
    return [...result].sort((l, r) => order(r) - order(l));
  }

  public orderedAll() {
    const order = memoize((n: T) => this.order(n));
    return [...this.nodes.keys()].sort((l, r) => order(r) - order(l));
  }

  public findCycle(): T[] {
    const colors = new Map<T, 'black' | 'gray'>();
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
