// Purpose of this namespace is to introduce source and sink concepts to
// transducer graphs and to provide runners that 'transduce' values from
// sources into sinks via a given graph.
import { opendir } from 'fs/promises'

import { composeIOGraph } from './iograph.js'
import * as r from './reducing.js'
import { derive } from './util.js'

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
      }))
  },

  debug: {
    sink: () => callSink(console.debug)
  },

  log: {
    sink: () => callSink(console.log)
  },

  call: {
    sink: callSink
  },

  timer: {
    // TODO: Add a second `jitter` arg that randomizes `ms`
    // TODO: figure out how to handle randomness.
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
      })
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
      }))
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
  sink: () =>
    callSink((x) => childPromises.push(
      runGraph(x, context)))
})

const runGraph = async (g, context) => {
  const childPromises = []
  const pipes = derive({}, context.pipes)
  const edges = derive({
    pipe: pipeEdgeConstructor(pipes),
    run: runEdgeConstructor(childPromises, derive({ pipes }, context))
  }, context.edges)

  const edgeFn = (_path, value) => {
    const [type, name, ...args] = value
    const edge = edges[name]
    return edge != null && edge[type] != null
      ? [edge[type](...args)]
      : []
  }

  const xfs = composeIOGraph(g, { rootFn: edgeFn, leafFn: edgeFn })
  const rfs = xfs.map(xf => xf(r.nullReducer))

  // Perform a single asynchronous step across all reducers. Any exceptions
  // that are raised are expected to be caught by inside the step calls and
  // forwarded via a generic error source.
  // NOTE: the accumulator is _always_ null below because the reducer is a
  // nullReducer
  await Promise.all(rfs.map(async rf => {
    try {
      await rf[r.STEP](null, context.initValue)
    } catch (e) {
      setImmediate(() => {
        if (pipes.error != null) {
          pipes.error.send(e)
        }
      })
    }

    return rf[r.RESULT](null)
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
