// Purpose of this namespace is to introduce source and sink concepts to
// transducer graphs and to provide runners that 'transduce' values from
// sources into sinks via a given graph.
import { opendir } from 'fs/promises'

import * as r from './reducing.js'
import { $ } from './pathref.js'
import { composeGraph } from './xfgraph.js'
import { derive, first, isa } from './util.js'
import { forwardErrors, remove, keep, isXf, dropAll } from './xflib.js'
import { graph, chain, isGraphable } from './graph.js'

const isArray = isa(Array)
export const isEdge = (x) =>
  isArray(x) && first(x) === 'edge'

export const isSource = (x) =>
  isArray(x) && first(x) === 'source'

export const isSink = (x) =>
  isArray(x) && first(x) === 'sink'

const makeIOSubgraph = (inputNodes) =>
  graph({
    nodes: {
      ...inputNodes,
      out: remove(isa(Error)),
      err: keep(isa(Error))
    },
    links: [
      [$.all, $.out],
      [$.all, $.err]
    ]
  })

const makeErrorGraph = (xf) =>
  makeIOSubgraph({
    in: forwardErrors(xf),
    all: $.in
  })

const makeEdgeGraph = ([_, ...args]) =>
  makeIOSubgraph({
    in: ['sink', ...args], // TODO: send inputs to all asynchronously
    all: ['source', ...args]
  })

const makeSourceGraph = ([_, ...args]) =>
  makeIOSubgraph({
    all: ['source', ...args]
  })

const augmentNode = (node) =>
  isXf(node)
    ? makeErrorGraph(node)
    : isEdge(node)
      ? makeEdgeGraph(node)
      : isSource(node)
        ? makeSourceGraph(node)
        : node

const augmentNodes = (nodes) =>
  Object.fromEntries(
    Object.entries(nodes)
      .map(([key, node]) => [key, augmentNode(node)]))

/**
 * Take a graph spec `g` and tranform/normalize the nodes as appropriate.
 * Currently, augmentNodes converts transducer and edge nodes into subgraphs
 * that capture errors and forward them as appropriate.
 */
export const iograph = ({ nodes = {}, links = [] } = { nodes: {}, links: [] }) =>
  graph({
    nodes: augmentNodes(nodes),
    links
  })

/**
 * Define an iograph as a chain of nodes
 */
export const iochain = (...nodes) =>
  chain(...augmentNodes(nodes))

/**
 * Return an array of all 'edge' nodes defined in `g` which is assumed to be a
 * directed graph defined by `graph2`.
 */
export const findSources = (nodes) =>
  Object.entries(nodes)
    .flatMap(([name, node]) =>
      (isGraphable(node) && isSource(node.nodes.all))
        ? [$[name].all]
        : [])

export const findSinks = (nodes) =>
  Object.entries(nodes)
    .flatMap(([name, node]) =>
      isSink(node)
        ? [$[name]]
        : (isGraphable(node) && isSink(node.nodes.in))
          ? [$[name].in]
          : [])

// Special 'sink' transducer that calls f(x) each STEP without calling down to the next STEP.
// f(x) is assumed to perform a side effect of some kind.
const callSink = (f) =>
  r.transducer(_ => ({
    [r.STEP]: (a, x) => {
      f(x)
      return a
    }
  }))

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

export const edges = {

  init: {
    source: () =>
      r.transducer(rf => ({
        [r.STEP]: async (a, x) => rf[r.STEP](a, x)
      })),
    sink: () => dropAll
  },

  debug: {
    source: () => dropAll,
    sink: () => callSink(console.debug)
  },

  log: {
    source: () => dropAll,
    sink: () => callSink(x => console.log(x))
  },

  call: {
    source: () => dropAll,
    sink: callSink
  },

  timer: {
    source: (ms) =>
      r.transducer(rf => {
        return {
          [r.STEP]: async (a, _x) => {
            let then = Date.now()
            while (!r.isReduced(a)) {
              await sleep(ms - (Date.now() - then))
              then = Date.now()
              a = rf[r.STEP](a, then)
              then += 1
            }
            return a
          }
        }
      }),

    sink: () => dropAll
  },

  dir: {
    source: (path) =>
      r.transducer(rf => ({
        [r.STEP]: async (a, _x) => {
          const dir = await opendir(path)
          for await (const dirent of dir) {
            a = rf[r.STEP](a, dirent)
            if (r.isReduced(a)) {
              break
            }
          }
          return a
        }
      })),
    sink: () => dropAll
  }
}

const pipeEdgeConstructor = (pipes) => ({
  source: (name) =>
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
    }),
  sink: (name) =>
    callSink((x) =>
      setImmediate(() => {
        if (pipes[name] != null) {
          pipes[name].send(x)
        }
      }))
})

// TODO erm, run the graph in the source section so that we can await the
// graph's completion and send a return value of some kind? Also, rungGraph
// errors maybe?
const runEdgeConstructor = (childPromises, context) => ({
  source: () =>
    dropAll,
  sink: () =>
    callSink((x) => childPromises.push(
      runGraph(x, context)))
})

const makeEdgeFn = (edges) =>
  (_path, value) => {
    if (isArray(value)) {
      const [type, name, ...args] = value
      return edges[name][type] != null
        ? [edges[name][type](...args)]
        : []
    } else {
      return []
    }
  }

const runGraph = async (g, context) => {
  const childPromises = []
  const pipes = derive({}, context.pipes)
  const edges = derive({
    pipe: pipeEdgeConstructor(pipes),
    run: runEdgeConstructor(childPromises, derive({ pipes }, context))
  }, context.edges)
  const edgeFn = makeEdgeFn(edges)

  const xfs = composeGraph(g, {
    rootFn: edgeFn,
    leafFn: edgeFn,
    rootPathRefs: findSources(g.nodes),
    leafPathRefs: findSinks(g.nodes)
  })
  const rf = r.nullReducer
  const a = rf[r.INIT]()
  const rfs = xfs.map(xf => xf(rf))

  await Promise.all(rfs.map(async rf => {
    const a2 = await rf[r.STEP](a, context.initValue)
    return rf[r.RESULT](r.ensureUnreduced(a2))
  }))

  await Promise.all(childPromises)
}

const rootContext = {
  initValue: process,
  edges,
  pipes: {}
}

export const run = (g, context = {}) =>
  runGraph(g, derive(context, rootContext))

// define edges, sources and sinks
export const edge = (...value) => ['edge', ...value]
export const source = (...value) => ['source', ...value]
export const sink = (...value) => ['sink', ...value]
