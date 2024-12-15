// Rules for this file
// 1. Coverage report should be at 100% when testing only this file.
// 2. Tests should be defined only in terms of the public API.

import { jest } from '@jest/globals'
import { flatMap, map, take, emit, takeAll } from '../xflib'
import { $ } from '../pathref'
import { source, sink } from '../iograph.js'
import { graph, chain } from '../graph.js'
import { run } from '../runner.js'

beforeAll(() => {
  console.debug = jest.fn()
  console.log = jest.fn()
  console.warn = jest.fn()
})

test('run works', async () => {
  expect(await run(graph()))
    .toStrictEqual(undefined)

  expect(await run(graph({})))
    .toStrictEqual(undefined)

  expect(await run(graph({
    nodes: {
      a: source('init'),
      b: sink('debug')
    }
  })))
    .toStrictEqual(undefined)

  let result = []
  expect(await run(graph({
    nodes: {
      a: source('init'),
      b: map(x => x.argv[0]),
      c: map(x => x.env.USER),
      d: sink('call', (x) => result.push(x))
    },
    links: [
      [$.a, $.b], [$.a, $.c], [$.b, $.d], [$.c, $.d]
    ]
  }), { initValue: { ...process, argv: ['hello'] } }))
    .toStrictEqual(undefined)
  expect(result)
    .toStrictEqual(['hello', process.env.USER])

  result = []
  expect(await run(graph({
    nodes: {
      a: source('init'),
      b: take(0),
      c: sink('call', (x) => result.push(x))
    },
    links: [[$.a, $.b], [$.b, $.c]]
  })))
    .toStrictEqual(undefined)
  expect(result)
    .toStrictEqual([])
})

test('various sources and sinks work', async () => {
  expect(await run(graph({
    nodes: {
      bad1: source('badSource'),
      bad2: sink('badSink')
    },
    links: [[$.bad1, $.bad2]]
  })))
    .toStrictEqual(undefined)

  expect(await run(graph({
    nodes: {
      a: source('timer', 0),
      b: take(2),
      c: map(ts => p => [ts, p]),
      d: sink('log')
    },
    links: [[$.a, $.b], [$.b, $.c], [$.c, $.d]]
  })))
    .toStrictEqual(undefined)

  expect(await run(graph({
    nodes: {
      a: source('init'),
      b: flatMap(x => [x.env.USER, x.env.HOME]),
      fooOut: sink('pipe', 'foo'),
      fooIn: source('pipe', 'foo'),
      c: take(1),
      d: sink('log')
    },
    links: [[$.a, $.b], [$.b, $.fooOut], [$.fooIn, $.c], [$.c, $.d]]
  }), { initValue: process }))
    .toStrictEqual(undefined)
})

test('pipes work', async () => {
  expect(await run(graph({
    nodes: {
      a: source('init'),
      fooPipe: source('pipe', 'foo'),
      barPipe: sink('pipe', 'bar')
    },
    links: [[$.a, $.barPipe]]
  })))
    .toStrictEqual(undefined)

  expect(await run(graph({
    nodes: {
      a: source('init'),
      b: flatMap(x => [x.env.USER, x.env.HOME, 43]),
      fooOut: sink('pipe', 'foo'),
      fooIn: source('pipe', 'foo'),
      c: take(2),
      d: sink('log')
    },
    links: [[$.a, $.b], [$.b, $.fooOut], [$.fooIn, $.c], [$.c, $.d]]
  }), { initValue: process }))
    .toStrictEqual(undefined)
})

test('timer works', async () => {
  expect(await run(graph({
    nodes: {
      a: source('timer', 0),
      b: take(3),
      c: sink('debug')
    },
    links: [
      [$.a, $.b],
      [$.b, $.c]
    ]
  })))
    .toStrictEqual(undefined)
})

test('missing sources or sinks work', async () => {
  expect(await run(graph({
    nodes: {
      a: take(1),
      b: take(2)
    },
    links: [
      [$.a, $.b]
    ]
  })))
    .toStrictEqual(undefined)
})

test('run sink works', async () => {
  expect(await run(graph({
    nodes: {
      a: source('init'),
      b: emit(graph({
        nodes: {
          a: source('init'),
          b: sink('debug')
        },
        links: [
          [$.a, $.b]
        ]
      })),
      c: sink('run')
    },
    links: [
      [$.a, $.b],
      [$.b, $.c]
    ]
  })))
    .toStrictEqual(undefined)
})

test('chain works', async () => {
  expect(await run(chain(
    source('init'),
    take(0),
    sink('debug')
  )))
    .toStrictEqual(undefined)
})

test('error handling works', async () => {
  // TODO reset the pipes state between runs!
  expect(await run(graph({
    nodes: {
      init: source('init'),
      test: map(_ => { throw new Error('Test Error') }),
      once: take(1),
      debug: sink('debug')
    },
    links: [
      [$.init, $.test],
      [$.test, $.once],
      [$.once, $.debug]
    ]
  })))
    .toStrictEqual(undefined)

  expect(await run(graph({
    nodes: {
      init: source('init'),
      error: source('pipe', 'error'),
      test: map(_ => { throw new Error('Test Error') }),
      once: take(1),
      debug: sink('debug')
    },
    links: [
      [$.init, $.test],
      [$.test, $.debug],
      [$.error, $.once],
      [$.once, $.debug]
    ]
  })))
    .toStrictEqual(undefined)
})

test('\'with\' source works', async () => {
  expect(await run(graph({
    nodes: {
      a: source('with', ['timestamp', 'rng', 'graph', 'initValue'], 'init'),
      b: takeAll,
      c: sink('debug')
    },
    links: [[$.a, $.b], [$.b, $.c]]
  }), { initValue: 42 }))
    .toStrictEqual(undefined)
})
