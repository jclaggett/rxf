// IOGraphs are transducer graphs with the additional concept of source (input)
// and sink (output) nodes at the edges (roots and leafs) of the graph. Also,
// internal transducer nodes are augmented to catch and forward exceptions on a
// special 'err' node.

import { $ } from './pathref.js'
import * as util from './util.js'
import * as xflib from './xflib.js'
import * as r from './reducing.js'
import { composeGraph } from './xfgraph.js'
import { isGraph } from './graph.js'

// edge, source and sink variants
export const source = util.variant('source')
export const isSource = util.isVariant('source')
export const sink = util.variant('sink')
export const isSink = util.isVariant('sink')

// IOGraph composition
const findEdges = (isEdge, nodes, ref) =>
  Object.entries(nodes)
    .flatMap(([name, node]) =>
      isGraph(node)
        ? findEdges(isEdge, node.nodes, ref[name])
        : isEdge(node)
          ? [ref[name]]
          : [])

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

const pipeEdgeConstructor = (pipes) => ({
  source: (_path, name) => [
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
          })
          return a
        }
      }
    })
  ],
  sink: (_path, name) =>
    callSink((x) =>
      Promise.resolve().then(() => {
        if (pipes[name] != null) {
          pipes[name].send(x)
        }
      }))
})

// TODO erm, run the graph in the source section so that we can await the
// graph's completion and send a return value of some kind? Also, rungGraph
// errors maybe?
const runEdgeConstructor = (childPromises, context) => ({
  sink: (_path) =>
    callSink((x) => childPromises.push(
      runGraph(x, context)))
})

const applyWithAttrs = (attrNames, attrs) =>
  (event) => ({
    ...Object.fromEntries(
      attrNames.map(attrName =>
        [attrName, attrs[attrName]()])),
    event
  })

export const composeIOGraph = (g, context) => {
  const childPromises = []
  const attrs = util.derive(
    {
      graph: () => g,
      initValue: () => context.initValue
    },
    context.attrs)
  const pipes = util.derive({}, context.pipes)
  const edges = util.derive(
    {
      pipe: pipeEdgeConstructor(pipes),
      run: runEdgeConstructor(childPromises, util.derive({ pipes }, context)),
      with: {
        source: (path, attrNames, ...args) => {
          return edgeFn(path, ['source', ...args])
            .map(xf => {
              return util.compose(
                xf,
                xflib.map(applyWithAttrs(attrNames, attrs)))
            })
        }
      }
    },
    context.edges)

  const edgeFn = (path, value) => {
    const [type, name, ...args] = value
    const edge = edges[name]
    return edge != null && edge[type] != null
      ? edge[type](path, ...args)
      : []
  }
  const xfs =
    composeGraph(g, {
      rootFn: edgeFn,
      leafFn: edgeFn,
      rootPathRefs: findEdges(isSource, g.nodes, $),
      leafPathRefs: findEdges(isSink, g.nodes, $)
    })
  return {
    start: async () => {
      // Perform a single asynchronous step across all reducers. Any exceptions
      // that are raised are expected to be caught by inside the step calls and
      // forwarded via a generic error source.
      // NOTE: the accumulator is _always_ null below because nullReducer is used
      const rfs = xfs.map(xf => xf(r.nullReducer))
      const sourcePromises = rfs.map(async rf => {
        try {
          await rf[r.STEP](null, context.initValue)
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
      await Promise.all(sourcePromises)
      return Promise.all(childPromises)
    }
  }
}
