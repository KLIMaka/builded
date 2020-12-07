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
  expect(graph.nodes).toStrictEqual(build().get());

  graph.add('a', 'b');
  graph.add('a', 'c');
  graph.add('c', 'd');
  graph.add('b', 'd');
  graph.remove('a');
  expect(graph.nodes).toStrictEqual(build().get());

  graph.add('a', 'b');
  graph.add('a', 'c');
  graph.add('c', 'd');
  graph.add('b', 'd');
  graph.add('d', 'a');
  expect(graph.findCycle()).toStrictEqual(['d', 'a', 'b']);
});
