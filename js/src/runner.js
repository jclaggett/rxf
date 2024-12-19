// Purpose of this namespace is to introduce source and sink concepts to
// transducer graphs and to provide runners that 'transduce' values from
// sources into sinks via a given graph.
import * as iog from './iograph.js'
import * as r from './reducing.js'
import { derive } from './util.js'

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

export const basicEdges = {

  init: {
    source: (_path) => [
      r.transducer(rf => ({
        [r.STEP]: async (a, x) => rf[r.STEP](a, x)
      }))
    ]
  },

  debug: {
    sink: (_path) => iog.callSink(console.debug)
  },

  log: {
    sink: (_path) => iog.callSink(console.log)
  },

  call: {
    sink: (_path, f) => iog.callSink(f)
  },

  timer: {
    // TODO: Add a second `jitter` arg that randomizes `ms`
    // TODO: figure out how to handle randomness.
    source: (_path, ms) => [
      r.transducer(rf => {
        return {
          [r.STEP]: async (a, _x) => {
            let then = Date.now()
            while (!r.isReduced(a)) {
              await sleep(ms - (Date.now() - then))
              then = Date.now()
              a = rf[r.STEP](a, then)
              then += 1 // why??
            }
            return a
          }
        }
      })
    ]
  }
}

const basicAttrs = {
  timestamp: () => Date.now(),
  rng: () => Math.random // Inversion of control is maintained (barely).
}

const runGraph = async (g, context) => {
  const runner = iog.composeIOGraph(g, context)
  await runner.start()
}

export const run = (g,
  {
    initValue = null,
    edges = {},
    attrs = {},
    pipes = {}
  } = {}) =>
  runGraph(g, {
    initValue,
    edges: derive(edges, basicEdges),
    attrs: derive(attrs, basicAttrs),
    pipes
  })
