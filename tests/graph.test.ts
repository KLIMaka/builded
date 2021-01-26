import { DirecredGraph } from "../src/utils/graph";


function build<T>() {
  const map = new Map<T, Set<T>>();
  const builder = {
    node: (parent: T, childs: T[]) => { map.set(parent, new Set(childs)); return builder; },
    get: () => map
  }
  return builder;
}

test('graph', () => {
  const graph = new DirecredGraph<string>();
  graph.add('a', 'b');
  graph.add('b', 'c');
  expect(graph.nodes).toStrictEqual(build().node('a', ['b']).node('b', ['c']).node('c', []).get());

  graph.remove('c');
  expect(graph.nodes).toStrictEqual(build().node('a', ['b']).node('b', []).get());

  graph.remove('a');
  expect(graph.nodes).toStrictEqual(build().node('b', []).get());

  graph.add('a', 'b');
  graph.add('a', 'c');
  graph.add('c', 'd');
  graph.add('b', 'd');
  graph.remove('a');
  expect(graph.nodes).toStrictEqual(build().node('b', ['d']).node('c', ['d']).node('d', []).get());

  graph.add('a', 'b');
  graph.add('a', 'c');
  graph.add('d', 'a');
  expect(graph.findCycle()).toStrictEqual(['d', 'a', 'b']);
});

test('order', () => {
  const graph = new DirecredGraph<string>();
  graph.add('a', 'd');
  graph.add('a', 'e');
  graph.add('b', 'd');
  graph.add('d', 'e');
  graph.add('c', 'e');
  graph.add('f', 'd');
  graph.add('g', 'h');
  graph.add('d', 'x');

  expect(['a', 'b', 'c', 'd', 'e', 'f'].map(e => graph.order(e))).toStrictEqual([2, 2, 1, 1, 0, 2]);
  expect(graph.orderedTo('e')).toStrictEqual(['a', 'b', 'f', 'd', 'c', 'e']);
  expect(graph.orderedAll()).toStrictEqual(['a', 'b', 'f', 'd', 'c', 'g', 'e', 'h', 'x']);
});
