// IOGraphs are transducer graphs with the additional concept of source (input)
// and sink (output) nodes at the edges (roots and leafs) of the graph. Also,
// internal transducer nodes are augmented to catch and forward exceptions on a
// special 'err' node.

import { $ } from './pathref.js'
import * as util from './util.js'
import * as r from './reducing.js'
import * as xflib from './xflib.js'
import * as xfgraph from './xfgraph.js'
import * as graph from './graph.js'

// edge, source and sink variants
export const source = util.variant('source')
export const isSource = util.isVariant('source')
export const sink = util.variant('sink')
export const isSink = util.isVariant('sink')

// Special 'sink' transducer that calls f(x) each STEP without calling down to the next STEP.
// f(x) is assumed to perform a side effect of some kind.
export const callSink = (f) => [
  r.transducer(_ => ({
    [r.STEP]: (a, x) => {
      f(x)
      return a
    }
  }))
]

const pipeEdgeConstructor = (pipes, input) => ({
  source: ({ stopPromise }, name) => [
    r.transducer(rf => {
      return {
        [r.STEP]: async (a, _x) => {
          await new Promise((resolve) => {
            const close = () => {
              delete pipes[name]
              resolve()
            }
            const send = (x) => {
              if (r.isReduced(rf[r.STEP](a, x))) {
                close()
              }
            }
            pipes[name] = { close, send }
            stopPromise.then(close)
          })
          return a
        }
      }
    })
  ],
  sink: (_, name) =>
    callSink(input(name))
})

const applyWithAttrs = (attrNames, attrs) =>
  (event) => ({
    ...Object.fromEntries(
      attrNames.map(attrName =>
        [attrName, attrs[attrName]()])),
    event
  })

// IOGraph composition
const findEdges = (isEdge, nodes, ref) =>
  Object.entries(nodes)
    .flatMap(([name, node]) =>
      graph.isGraph(node)
        ? findEdges(isEdge, node.nodes, ref[name])
        : isEdge(node)
          ? [ref[name]]
          : [])

export const iograph = (
  g,
  {
    initValue = null,
    edges = {},
    attrs = {},
    pipes = {}
  } = {}) => {
  g = graph.ensureGraph(g)

  let resolveStopPromise = null
  const stopPromise = new Promise((resolve) => {
    resolveStopPromise = resolve
  })
  const childPromises = []

  attrs = util.derive(
    {
      graph: () => g,
      initValue: () => initValue
    },
    attrs)
  pipes = util.derive(
    {},
    pipes)
  const input =
    (name) =>
      (x) =>
        Promise.resolve().then(() => {
          if (pipes[name] != null) {
            pipes[name].send(x)
          }
        })

  edges = util.derive(
    {
      init: {
        source: (_) => [
          r.transducer(rf => ({
            [r.STEP]: async (a, x) => rf[r.STEP](a, x)
          }))
        ]
      },
      with: {
        source: (edgeContext, attrNames, ...args) => {
          return edgeFn(edgeContext, ['source', ...args])
            .map(xf => {
              return util.compose(
                xf,
                xflib.map(applyWithAttrs(attrNames, attrs)))
            })
        }
      },
      call: {
        sink: (_, f) => [
          r.transducer(_rf => ({
            [r.STEP]: (a, x) => {
              f(x, input)
              return a
            }
          }))
        ]
      },
      pipe: pipeEdgeConstructor(pipes, input),
      run: {
        sink: ({ }) =>
          callSink((g) => {
            const runner = iograph(g, { initValue, attrs, pipes, edges })
            stopPromise.then(runner.stop)
            childPromises.push(runner.start())
          })
      }
    },
    edges)

  const edgeFn = (path, value) => {
    const [type, name, ...args] = value
    const edge = edges[name]
    return edge != null && edge[type] != null
      ? edge[type]({ path, stopPromise, pipes }, ...args)
      : []
  }
  const xfs =
    xfgraph.composeGraph(g, {
      rootFn: edgeFn,
      leafFn: edgeFn,
      rootPathRefs: findEdges(isSource, g.nodes, $),
      leafPathRefs: findEdges(isSink, g.nodes, $)
    })

  const inst = {
    isRunning: false,
    stop: resolveStopPromise,
    pipes: pipes
  }
  inst.start = async () => {
    // Perform a single asynchronous step across all reducers. Any exceptions
    // that are raised are expected to be caught by inside the step calls and
    // forwarded via a generic error source.
    // NOTE: the accumulator is _always_ null below because nullReducer is
    // always the base reducer used.
    const rfs = xfs.map(xf => xf(r.nullReducer))
    const sourcePromises = rfs.map(async rf => {
      try {
        await rf[r.STEP](null, initValue)
      } catch (e) {
        Promise.resolve().then(() => {
          if (pipes.error == null) {
            console.warn(`Warning! Error was ignored: ${e}`)
          } else {
            pipes.error.send(e)
          }
        })
      }

      return rf[r.RESULT](null)
    })
    inst.isRunning = true
    await Promise.all(sourcePromises)
    await Promise.all(childPromises)
    inst.isRunning = false
  }

  return inst
}
