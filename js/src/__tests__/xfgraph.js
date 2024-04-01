// Rules for this file
// 1. Coverage report should be at 100% when testing only this file.
// 2. Tests should be defined only in terms of the public API.

import { transduce, toArray } from '../reducing'
import { map, take } from '../xflib'
import { identity } from '../util'
import { $ } from '../pathref'
import { graph } from '../graph'
import {
  composeGraph, xfgraph, mapjoin
} from '../xfgraph'

const T = (xf, data) =>
  transduce(xf(toArray), [], data)

test('composeGraph works', () => {
  expect(composeGraph(graph(), {
    leafFn: (_path, _value) => [],
    rootFn: (_path, _value, xf) => xf,
    leafPathRefs: [],
    rootPathRefs: []
  }))
    .toStrictEqual([])
})

test('empty xfgraph works', () => {
  expect(T(xfgraph(graph()), []))
    .toStrictEqual([])

  expect(T(xfgraph(graph(), {}), []))
    .toStrictEqual([])
})

test('xfgraph works', () => {
  const g = graph({
    nodes: {
      a: identity,
      b: identity,
      c: map(x => x + 1),
      d: take(1)
    },
    links: [
      [$.a, $.c],
      [$.a, $.d],
      [$.b, $.d]
    ]
  })

  expect(T(
    xfgraph(g, {
      rootPathRefs: [$.a, $.b],
      leafPathRefs: [$.c, $.d]
    }),
    [['a', 3], ['b', 2]]))
    .toStrictEqual([['c', 4], ['d', 3], ['d'], ['c']])
})

test('mapjoin works', () => {
  expect(T(xfgraph(graph({
    nodes: {
      a: identity,
      b: identity,
      c: identity,
      d: mapjoin(
        (x, y, z) => x + y + z,
        [{ active: true }, { active: false }, { transient: true }])
    },
    links: [
      [$.a, $.d[0]],
      [$.b, $.d[1]],
      [$.c, $.d[2]]
    ]
  }), {
    rootPathRefs: [$.a, $.b, $.c],
    leafPathRefs: [$.d]
  }), [
    ['a', 3], ['b', 2], ['c', 4],
    ['b', 3], ['b', 4], ['a', 5], ['c', 6]
  ]))
    .toStrictEqual([['d', 9], ['d', 15], ['d']])
})
