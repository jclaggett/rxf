// Rules for this file
// 1. Coverage report should be at 100% when testing only this file.
// 2. Tests should be defined only in terms of the public API.

import { identity } from '../util.js'
import { multiplex, tag, detag } from '../xflib.js'
import { transduce, toArray } from '../reducing.js'
import { $ } from '../pathref'
import { composeIOGraph, edge, source, sink, iograph, iochain } from '../iograph.js'

const edgeFn = (_path, [type, name]) =>
  [(type === 'source' ? detag : tag)(name)]

// Implicitly test composeIOGraph by using it to test iochain and iograph
const testGraph = (g, inputs) =>
  transduce(
    multiplex(composeIOGraph(g, { rootFn: edgeFn, leafFn: edgeFn }))(toArray),
    [],
    inputs)

test('iochain works', () => {
  expect(testGraph(
    iochain(),
    []
  ))
    .toStrictEqual([])

  expect(testGraph(
    iochain(identity),
    []
  ))
    .toStrictEqual([])

  expect(testGraph(
    iochain(
      source('a'),
      identity,
      sink('b')
    ),
    [['a', 1], ['a']]
  ))
    .toStrictEqual([['b', 1], ['b']])
})

test('iograph works', () => {
  expect(testGraph(
    iograph(),
    []
  ))
    .toStrictEqual([])

  expect(testGraph(
    iograph({}),
    []
  ))
    .toStrictEqual([])

  expect(testGraph(
    iograph({
      nodes: {
        a: edge('a'),
        b: identity
      },
      links: [
        [$.a, $.b],
        [$.b, $.a]
      ]
    }),
    [['a', 1], ['b', 2], ['a', 3]]
  ))
    .toStrictEqual([['a', 1], ['a', 3], ['a']])
})