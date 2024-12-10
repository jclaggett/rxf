// Purpose of this namespace is to introduce source and sink concepts to
// transducer graphs and to provide runners that 'transduce' values from
// sources into sinks via a given graph.
import { composeIOGraph } from './iograph.js'
import * as r from './reducing.js'
import { derive, compose } from './util.js'
import { map } from './xflib.js'

// Special 'sink' transducer that calls f(x) each STEP without calling down to the next STEP.
// f(x) is assumed to perform a side effect of some kind.
const callSink = (f) => [
  r.transducer(_ => ({
    [r.STEP]: (a, x) => {
      f(x)
      return a
    }
  }))
]

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
    sink: (_path) => callSink(console.debug)
  },

  log: {
    sink: (_path) => callSink(console.log)
  },

  call: {
    sink: (_path, f) => callSink(f)
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

const basicAttributes = {
  timestamp: () => Date.now(),
  rng: () => Math.random // Inversion of control is maintained (barely).
}

const withAttributes = (attrNames, attrs) =>
  (event) => ({
    ...Object.fromEntries(
      attrNames.map(attrName =>
        [attrName, attrs[attrName]()])),
    event
  })

const composeRunner = (g, context) => {
  const childPromises = []
  const dynamicAttributes = derive(
    {
      graph: () => g,
      initValue: () => context.initValue
    },
    basicAttributes)
  const pipes = derive({}, context.pipes)
  const edges = derive({
    pipe: pipeEdgeConstructor(pipes),
    run: runEdgeConstructor(childPromises, derive({ pipes }, context)),
    with: {
      source: (path, attrNames, ...args) => {
        return edgeFn(path, ['source', ...args])
          .map(xf => {
            return compose(
              xf,
              map(withAttributes(attrNames, dynamicAttributes)))
          })
      }
    }

  }, context.edges)

  const edgeFn = (path, value) => {
    const [type, name, ...args] = value
    const edge = edges[name]
    return edge != null && edge[type] != null
      ? edge[type](path, ...args)
      : []
  }
  const xfs = composeIOGraph(g, { rootFn: edgeFn, leafFn: edgeFn })

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

const runGraph = async (g, context) => {
  const runner = composeRunner(g, context)
  await runner.start()
}

export const run = (g, { initValue = null, edges = {}, pipes = {} } = {}) =>
  runGraph(g, {
    initValue,
    edges: derive(edges, basicEdges),
    pipes
  })
