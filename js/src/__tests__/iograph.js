// Rules for this file
// 1. Coverage report should be at 100% when testing only this file.
// 2. Tests should be defined only in terms of the public API.

import { jest } from '@jest/globals'
import { $ } from '../pathref'
import * as r from '../reducing.js'
import * as xflib from '../xflib.js'
import * as graph from '../graph.js'
import * as iograph from '../iograph.js'

test('source and sink both work', () => {
  const source1 = iograph.source('source1', 42)
  const sink1 = iograph.sink('sink1', 43)
  expect(iograph.isSource(source1))
  expect(iograph.isSink(sink1))
  expect(!iograph.isSource(sink1))
  expect(!iograph.isSink(source1))
})

test('callSink works', () => {
  let x = 2
  const cs = iograph.callSink(y => x += y)
  const callReducer = cs[0](r.nullReducer)
  expect(callReducer[r.STEP](null, 3))
    .toStrictEqual(null)
  expect(x).toStrictEqual(5)
})

test('iograph works', async () => {
  let outValue = 0
  const gDef = {
    nodes: {
      init: graph.graph({
        nodes: {
          in: iograph.source('init'),
          out: $.in
        },
        links: []
      }),
      pipe1Source: iograph.source(
        'with', ['graph', 'initValue'],
        'pipe', 1),
      pipe2Source: iograph.source('pipe', 2),
      extractEventValue: xflib.map(({ event }) => event),
      append44: xflib.append(44),
      take1: xflib.take(1),
      setOutValue: iograph.sink('call', x => outValue = x),
      pipe2Sink: iograph.sink('pipe', 2),
      pipe3Sink: iograph.sink('pipe', 3),

      bogusSource: iograph.source('bogus'),
      bogusSink: iograph.sink('bogus')

    },
    links: [
      [$.init, $.append44],
      [$.pipe1Source, $.extractEventValue, $.append44],
      [$.pipe1Source, $.pipe2Sink],
      [$.append44, $.setOutValue],
      [$.pipe2Source, $.take1, $.pipe3Sink],
      [$.bogusSource, $.bogusSink],
    ]
  }

  const gRun = iograph.iograph(gDef, {
    initValue: 42,
    attrs: {},
    pipes: {},
    edges: {}
  })
  expect(gRun.isRunning).toStrictEqual(false)
  expect(outValue).toStrictEqual(0)
  expect(gRun.pipes[1]).toBeUndefined()
  expect(gRun.pipes[2]).toBeUndefined()
  expect(gRun.pipes[3]).toBeUndefined()

  const p = gRun.start()
  expect(gRun.isRunning).toStrictEqual(true)
  expect(outValue).toStrictEqual(42)
  expect(gRun.pipes[1]).toBeDefined()
  expect(gRun.pipes[2]).toBeDefined()

  gRun.pipes[1].send(43)
  // wait for the send (and underlying pipe promises) to complete
  await new Promise(resolve => resolve())
  expect(outValue).toStrictEqual(43)
  expect(p).toBeInstanceOf(Promise)
  expect(gRun.pipes[2]).toBeUndefined()

  gRun.stop()
  await p
  expect(gRun.isRunning).toStrictEqual(false)
  expect(outValue).toStrictEqual(44)
  expect(gRun.pipes[1]).toBeUndefined()
  expect(gRun.pipes[2]).toBeUndefined()
  expect(gRun.pipes[3]).toBeUndefined()
})

test('iograph child graphs work', async () => {
  let outValue = {}
  const childGraphDef = (i) => ({
    nodes: {
      init: iograph.source('init'),
      out: iograph.sink('call', x => outValue[i] = x)
    },
    links: [
      [$.init, $.out]
    ]
  })
  const gDef = {
    nodes: {
      init: iograph.source('init'),
      genValues: xflib.mapcat(_ => [1, 2, 3, 4]),
      childgraphs: xflib.map(childGraphDef),
      runSink: iograph.sink('run')
    },
    links: [
      [$.init, $.genValues, $.childgraphs, $.runSink]
    ]
  }

  const gRun = iograph.iograph(gDef)
  await gRun.start()
  expect(outValue)
    .toStrictEqual({ 1: null, 2: null, 3: null, 4: null })
})

test('iograph error handling works', async () => {
  const originalWarn = console.warn
  console.warn = jest.fn()

  const gDef = {
    nodes: {
      init: iograph.source('init'),
      error: iograph.sink('call', () => { throw new Error('test error') })
    },
    links: [
      [$.init, $.error]
    ]
  }
  const gRun = iograph.iograph(gDef)
  await gRun.start()

  const outValue = {}
  const gDefErrorHandling = {
    nodes: {
      init: iograph.source('init'),
      error: iograph.sink('call', () => { throw new Error('test error') }),

      err: iograph.source('pipe', 'error'),
      out: iograph.sink('call', x => outValue['error'] = x)
    },
    links: [
      [$.init, $.error],
      [$.err, $.out]
    ]
  }
  const gRunEH = iograph.iograph(gDefErrorHandling)
  const p = gRunEH.start()
  // wait for the graph to call init
  await new Promise(resolve => resolve())
  gRunEH.stop()
  await p

  console.warn = originalWarn
})

test('iograph call sinks can use input parameter.', async () => {
  let outValue = null
  const gDef = {
    nodes: {
      init: iograph.source('init'),
      call: iograph.sink('call',
        (x, input) => input('pipe')(x + 1)),

      pipeSource: iograph.source('pipe', 'pipe'),
      out: iograph.sink('call', x => outValue = x)
    },
    links: [
      [$.init, $.call],
      [$.pipeSource, $.out]
    ]
  }
  const gRun = iograph.iograph(gDef, { initValue: 42 })
  const p = gRun.start()
  // wait for the graph to call init
  await new Promise(resolve => resolve())
  gRun.stop()
  await p
  expect(outValue).toStrictEqual(43)
})
