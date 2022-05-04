import { DirecredGraph, Links } from "../src/utils/graph";


function build<T>() {
  const map = new Map<T, Links<T>>();
  const builder = {
    node: (parent: T, childs: T[], parents: T[]) => { map.set(parent, { from: new Set(parents), to: new Set(childs) }); return builder; },
    get: () => map
  }
  return builder;
}

test('graph', () => {
  const graph = new DirecredGraph<string>();
  graph.add('a', 'b');
  graph.add('b', 'c');
  expect(graph.nodes).toStrictEqual(build().node('a', ['b'], []).node('b', ['c'], ['a']).node('c', [], ['b']).get());

  graph.remove('c');
  expect(graph.nodes).toStrictEqual(build().node('a', ['b'], []).node('b', [], ['a']).get());

  graph.remove('a');
  expect(graph.nodes).toStrictEqual(build().node('b', [], []).get());

  graph.add('a', 'b');
  graph.add('a', 'c');
  graph.add('c', 'd');
  graph.add('b', 'd');
  graph.remove('a');
  expect(graph.nodes).toStrictEqual(build().node('b', ['d'], []).node('c', ['d'], []).node('d', [], ['c', 'b']).get());

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

  expect(['a', 'b', 'c', 'd', 'e', 'f', 'x'].map(e => graph.order(e))).toStrictEqual([2, 2, 1, 1, 0, 2, 0]);
  expect(graph.orderedTo('e')).toStrictEqual(['a', 'b', 'f', 'd', 'c', 'e']);
  expect(graph.orderedTo('x')).toStrictEqual(['a', 'b', 'f', 'd', 'x']);
  expect(graph.orderedAll()).toStrictEqual(['a', 'b', 'f', 'd', 'c', 'g', 'e', 'h', 'x']);
});

test('value dependency', () => {
  const graph = new DirecredGraph<string>();
  graph.add('a', 'b');
  graph.add('b', 'c');
  graph.add('e', 'x');
  expect(['a', 'c', 'x'].map(e => graph.order(e))).toStrictEqual([2, 0, 0]);

});

test('subgraph', () => {
  const graph = new DirecredGraph<string>();
  graph.add('a', 'b');
  graph.add('b', 'c');
  graph.add('d', 'e');
  graph.add('e', 'f');
  expect([...graph.subgraphs()]).toStrictEqual([['b', 'c', 'a'], ['e', 'f', 'd']]);

  graph.add('c', 'a');
  expect([...graph.subgraphs()]).toStrictEqual([['b', 'c', 'a'], ['e', 'f', 'd']]);

  graph.add('a', 'e');
  expect([...graph.subgraphs()]).toStrictEqual([['b', 'c', 'a', 'e', 'f', 'd']]);
});
