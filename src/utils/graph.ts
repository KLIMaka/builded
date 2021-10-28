import { chain, filter, flatten, map, pairs, reduce, wrap } from './collections';
import { memoize } from './mathutils';

export type Links<T> = { to: Set<T>, from: Set<T> };
export class DirecredGraph<T> {
  readonly nodes = new Map<T, Links<T>>();

  private ensureNode(label: T) {
    let links = this.nodes.get(label);
    if (links == undefined) {
      links = { to: new Set(), from: new Set() };
      this.nodes.set(label, links);
    }
    return links;
  }

  public add(from: T, to: T) {
    this.ensureNode(to).from.add(from)
    this.ensureNode(from).to.add(to);
  }

  public addChain(chain: T[]) {
    for (const [c1, c2] of pairs(wrap(chain))) this.add(c1, c2);
  }

  public remove(n: T) {
    const node = this.nodes.get(n);
    if (node == undefined) return;
    node.to.forEach(n1 => this.nodes.get(n1).from.delete(n));
    node.from.forEach(n1 => this.nodes.get(n1).to.delete(n));
    this.nodes.delete(n);
  }

  public order(node: T): number {
    const links = this.nodes.get(node).to;
    if (links.size == 0) return 0;
    return reduce(map(links, n => this.order(n)), Math.max, 0) + 1
  }

  public orderedTo(node: T) {
    const result = new Set<T>();
    result.add(node);
    for (const n of result) this.nodes.get(n).from.forEach(n => result.add(n));
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
      const links = nodes.get(node);
      for (const child of links.to) {
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

  public supgraphs(): T[][] {
    const visited = new Set();
    const nodes = this.nodes;
    const collect = function (node: T) {
      if (visited.has(node)) return [];
      const links = nodes.get(node);
      visited.add(node);
      return [node, ...flatten(map(chain(links.to, links.from), collect))];
    }
    return [...map(filter(this.nodes.keys(), n => !visited.has(n)), collect)];
  }
}
