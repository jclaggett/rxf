// Rules for this file
// 1. Coverage report should be at 100% when testing only this file.
// 2. Tests should be defined only in terms of the public API.

import { identity } from '../util.js'
import { spread, tag, detag } from '../xflib.js'
import { transduce, toArray } from '../reducing.js'
import { $ } from '../pathref'
import * as graph from '../graph.js'
import * as util from '../util.js'
import * as r from '../reducing.js'
import * as iograph from '../iograph.js'

const edgeFn = (_path, [type, name]) =>
  [(type === 'source' ? detag : tag)(name)]

// Implicitly test composeIOGraph by using it to test iochain and iograph
const testGraph = (g, inputs) =>
  transduce(
    spread(composeIOGraph(g, { rootFn: edgeFn, leafFn: edgeFn }))(toArray),
    [],
    inputs)

test('source and sink', () => {
  const source1 = iograph.source('source1', 42)
  const sink1 = iograph.sink('sink1', 43)
  expect(iograph.isSource(source1))
  expect(iograph.isSink(sink1))
  expect(!iograph.isSource(sink1))
  expect(!iograph.isSink(source1))
})

test('callSink', () => {
  let x = 2
  const cs = iograph.callSink(y => x += y)
  const callReducer = cs[0](r.nullReducer)
  expect(callReducer[r.STEP](null, 3))
    .toStrictEqual(null)
  expect(x).toStrictEqual(5)
})

test('composeIOGraph', async () => {
  const gDef = {
    nodes: {
      a: iograph.source('pipe', 'a'),
      b: iograph.sink('pipe', 'b')
    },
    links: [
      [$.a, $.b]
    ]
  }

  const gRun = iograph.iograph(gDef, {
    initValue: 42,
    attrs: {},
    pipes: {},
    edges: {}
  })

  expect(gRun.isRunning).toStrictEqual(false)
  const p = gRun.start()
  expect(gRun.isRunning).toStrictEqual(true)
  expect(p).toBeInstanceOf(Promise)
  gRun.stop()
  await p
  expect(gRun.isRunning).toStrictEqual(false)
})
