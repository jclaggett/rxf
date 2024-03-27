// Rules for this file
// 1. Coverage report should be at 100% when testing only this file.
// 2. Tests should be defined only in terms of the public API.

import { jest } from '@jest/globals'
import { $ } from '../pathref'
import { graph, walkGraph, chain, pg } from '../graph'

const s = (...args) => new Set(args)

const inAndOut = (g) => ({ in: g.in, out: g.out })

test('defining graphs', () => {
  expect(graph())
    .toStrictEqual({ nodes: {}, links: [], in: {}, out: {} })
  expect(graph({}))
    .toStrictEqual({ nodes: {}, links: [], in: {}, out: {} })
  expect(graph({ nodes: {}, links: [] }))
    .toStrictEqual({ nodes: {}, links: [], in: {}, out: {} })
  expect(() => graph({
    nodes: {},
    links: [
      [$.a, $.b]
    ]
  }))
    .toThrow()

  const g = graph({
    nodes: {
      a: 43,
      b: true
    },
    links: [
      [$.a, $.b]
    ]
  })
  expect(inAndOut(g))
    .toStrictEqual({
      in: { b: s(['a']) },
      out: { a: s(['b']) }
    })

  const g2 = graph({
    nodes: {
      a: 24,
      b: 'hello',
      in: $.a,
      out: $.b
    },
    links: [
      [$.a, $.b],
      [$.a, $.b],
      [$.in, $.out]
    ]
  })
  expect(inAndOut(g2))
    .toStrictEqual({
      in: { b: s(['a']) },
      out: { a: s(['b']) }
    })
})

test('self-referencing alias fails', () => {
  expect(() => graph({
    nodes: {
      a: $.b, b: $.a
    },
    links: [
      [$.a, $.b]
    ]
  }))
    .toThrow()
})

test('subgraphs missing "out" node fails', () => {
  expect(() => graph({
    nodes: {
      a: graph(), b: true
    },
    links: [
      [$.a, $.b]
    ]
  }))
    .toThrow()
})

test('subgraphs missing "in" node fails', () => {
  expect(() => graph({
    nodes: {
      a: 43, b: graph()
    },
    links: [
      [$.a, $.b]
    ]
  }))
    .toThrow()
})

test('subpath into non-graph node fails', () => {
  expect(() => graph({
    nodes: {
      a: 43, b: 23
    },
    links: [
      [$.a.b, $.b]
    ]
  }))
    .toThrow()

  expect(() => graph({
    nodes: {
      a: 43, b: 23
    },
    links: [
      [$.a, $.b.c]
    ]
  }))
    .toThrow()
})

test('cycles in graph to fail', () => {
  expect(() => graph({
    nodes: {
      a: 43, b: 23
    },
    links: [
      [$.a, $.b],
      [$.b, $.b]
    ]
  }))
    .toThrow()

  expect(() => graph({
    nodes: {
      a: 43, b: 23
    },
    links: [
      [$.a, $.b],
      [$.b, $.a]
    ]
  }))
    .toThrow()
})

test('defining subgraphs', () => {
  expect(inAndOut(graph({
    nodes: {
      a: graph({ nodes: { out: 42 } }), b: true
    },
    links: [
      [$.a, $.b]
    ]
  })))
    .toStrictEqual({
      in: { b: s(['a', 'out']) },
      out: { a: { out: s(['b']) } }
    })

  expect(inAndOut(graph({
    nodes: {
      a: graph({ nodes: { out: 42 } }),
      b: graph({ nodes: { in: 56 } })
    },
    links: [
      [$.a, $.b]
    ]
  }
  )))
    .toStrictEqual({
      in: { b: { in: s(['a', 'out']) } },
      out: { a: { out: s(['b', 'in']) } }
    })
})

test('walking graphs', () => {
  const g = graph({
    nodes: {
      1: 22,
      a: graph({ nodes: { in: 34, out: 42 }, links: [[$.in, $.out]] }),
      b: graph({ nodes: { in: 56, out: 78 }, links: [[$.in, $.out]] }),
      c: 97
    },
    links: [
      [$[1], $.c],
      [$.a, $.b],
      [$.a, $.c],
      [$.a.in, $.a.out]
    ]
  })

  expect(walkGraph(g, [$[1], $.a.in], [$.c], (a, v) => [v, ...a]))
    .toStrictEqual([[22, [97]], [34, [42, [56, [78]], [97]]]])

  expect(walkGraph(g, [$.b.out, $.c], [$[1]], (a, v) => [v, ...a], 'in'))
    .toStrictEqual([[78, [56, [42, [34]]]], [97, [22], [42, [34]]]])

  expect(() => walkGraph(g, [$.badref], [], (a, v) => [v, ...a]))
    .toThrow()
  expect(() => walkGraph(g, [], [$.badref], (a, v) => [v, ...a]))
    .toThrow()
})

test('printing graphs', () => {
  console.dir = jest.fn()
  pg(graph({ nodes: { a: 1, b: 2 } }))
  expect(console.dir).toHaveBeenCalled()
})

test('chain works', () => {
  expect(inAndOut(chain(1, 2, 3)))
    .toStrictEqual({
      in: { 1: s(['0']), 2: s(['1']) },
      out: { 0: s(['1']), 1: s(['2']) }
    })
})
