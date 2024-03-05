// Purpose of this namespace is to introduce source and sink concepts to
// transducer graphs and to provide runners that 'transduce' values from
// sources into sinks via a given graph.
import { opendir } from 'fs/promises'

import * as r from './reducing.js'
import { $ } from './pathref.js'
import { composeGraph } from './xfgraph.js'
import { derive, first, isa, identity } from './util.js'
import { forwardErrors, remove, keep, isXf } from './xflib.js'
import { graph, isGraphable } from './graph.js'

const isArray = isa(Array)
export const isEdge = (x) =>
  isArray(x) &&
  (first(x) === 'source' ||
    first(x) === 'sink' ||
    first(x) === 'edge')

const makeIOGraph = (inputNodes) =>
  graph({
    ...inputNodes,
    out: remove(isa(Error)),
    err: keep(isa(Error))
  }, [
    [$.all, $.out],
    [$.all, $.err]
  ])

const makeErrorGraph = (xf) =>
  makeIOGraph({
    in: forwardErrors(xf),
    all: $.in
  })

const makeEdgeGraph = (edge) =>
  makeIOGraph({
    in: identity, // TODO: send inputs to all asynchronously
    all: edge
  })

const augmentNode = (node) =>
  isXf(node)
    ? makeErrorGraph(node)
    : isEdge(node)
      ? makeEdgeGraph(node)
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
export const iograph = (nodes = {}, links = []) =>
  graph(augmentNodes(nodes), links)

/**
 * Return an array of all 'edge' nodes defined in `g` which is assumed to be a
 * directed graph defined by `graph2`.
 */
export const findEdges = (g) =>
  Object.entries(g.nodes)
    .filter(([_, node]) => isGraphable(node) && isEdge(node))
    .map(first)

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

export const sources = {
  init: () =>
    r.transducer(rf => ({
      [r.STEP]: async (a, x) => rf[r.STEP](a, x)
    })),

  timer: (ms) =>
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

  dir: (path) =>
    r.transducer(rf => ({
      [r.STEP]: async (a, _x) => {
        const dir = await opendir(path)
        for await (const dirent of dir) {
          a = rf[r.STEP](a, dirent)
        }
        return a
      }
    }))
}

const pipeSourceConstructor = (pipes) =>
  (name) =>
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

// Special 'sink' transducer that calls f(x) each STEP without calling down to the next STEP.
// f(x) is assumed to perform a side effect of some kind.
const callSink = (f) =>
  r.transducer(_ => ({
    [r.STEP]: (a, x) => {
      f(x)
      return a
    }
  }))

const pipeSinkConstructor = (pipes) =>
  (name) =>
    callSink((x) =>
      setImmediate(() => {
        if (pipes[name] != null) {
          pipes[name].send(x)
        }
      }))

const runSinkConstructor = (childPromises, context) =>
  () =>
    callSink((x) => childPromises.push(
      runGraph(x, context)))

export const sinks = {
  debug: () => callSink(console.debug),
  log: () => callSink(console.log),
  call: callSink
}

const makeEdgeFn = (edgeType, edges) =>
  (_path, value) => {
    if (Array.isArray(value)) {
      const [et, name, ...args] = value
      return ((et === edgeType) && (edges[name] != null))
        ? [edges[name](...args)]
        : []
    } else {
      return []
    }
  }

const runGraph = async (g, context) => {
  const childPromises = []
  const pipes = derive({}, context.pipes)
  const sources = derive({
    pipe: pipeSourceConstructor(pipes)
  }, context.sources)

  const sinks = derive({
    run: runSinkConstructor(childPromises, derive({ pipes }, context)),
    pipe: pipeSinkConstructor(pipes)
  }, context.sinks)

  const edges = findEdges(g)
  const rootPathRefs = edges.map(edge => $[edge].all)
  const leafPathRefs = edges.map(edge => $[edge].in)

  const xfs = composeGraph(g, {
    leafFn: makeEdgeFn('sink', sinks),
    rootFn: makeEdgeFn('source', sources),
    leafPathRefs,
    rootPathRefs
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
  sources,
  sinks,
  pipes: {}
}

export const run = (g, context = {}) =>
  runGraph(g, derive(context, rootContext))

// define sources and sinks
export const source = (...value) => ['source', ...value]
export const sink = (...value) => ['sink', ...value]
