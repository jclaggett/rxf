// Purpose of this namespace is to apply tranducers to graphs and is marked
// with the assumption that node values are either transducers or are treated
// as identity (i.e., a trivial transducer).

import { transducer, STEP } from './reducing.js'
import { map, tag, detag, multiplex, demultiplex } from './xflib.js'
import { $ } from './pathref.js'
import { graph, walkGraph } from './graph.js'
import { identity, compose } from './util.js'

/**
 * Walk a graph of transducers using `multiplex` and `demultiplex` to combine
 * idividual transducers into a 'reduced' set of transducers. Use `leafFn` to
 * provide zero or more sink transducers (i.e., causes side effects.). Use
 * `rootFn` to provide zero or more source transducers (i.e., responds to side
 * effects.). The source transducers returned are also assumed to be defined
 * with asynchronous STEP functions.
 */
export const composeGraph = (g, { leafFn, leafPathRefs, rootFn, rootPathRefs }) => {
  return walkGraph(g, rootPathRefs, leafPathRefs,
    (xfs, node, { root, leaf, path, parentPaths }) => {
      // Stage 1: leaf nodes
      if (leaf) {
        xfs = leafFn(path, node)
      } else {
        xfs = xfs.flatMap(identity)
      }

      // Stage 2: multiplex
      if ((typeof node === 'function') && (node !== identity) && (xfs.length > 0)) {
        xfs = [compose(node, multiplex(xfs))]
      }

      // Stage 3: demultiplex
      if (parentPaths.length > 1) {
        xfs = xfs.map(xf => compose(demultiplex(parentPaths.length), xf))
      }

      // Stage 4: root nodes
      if (root && xfs.length > 0) {
        const leafXf = multiplex(xfs)
        xfs = rootFn(path, node).map(rootXf => compose(rootXf, leafXf))
      }

      return xfs
    }).flatMap(identity)
}

/**
 * return a transducer from `g`. This transducer expects a stream of variants
 * where the 'type' of each variant is associated with any of the root nodes in
 * the graph (Root nodes have no parents). The stepped values from the
 * transducer are variants associated with any of the leaf nodes in the graph
 * (Leaf nodes have no children).
 */
export const xfgraph = (g, {
  rootPathRefs = [],
  leafPathRefs = []
} = {
  rootPathRefs: [],
  leafPathRefs: []
}) => {
  const xfs = composeGraph(g, {
    leafFn: ([name], _value) => [tag(name)],
    rootFn: ([name], _value) => [detag(name)],
    leafPathRefs,
    rootPathRefs
  })

  return multiplex(xfs)
}

/**
 * return a graph that joins multiple inputs as arguments to `f`. `actives`
 * describes which inputs generate new calls to `f` when new values are
 * received.
 */
export const mapjoin = (f, argSpecs) => {
  const joiner = transducer(r => {
    const joined = new Array(argSpecs.length)
    const needed = new Set(argSpecs.keys())
    const transients = argSpecs.flatMap(({ transient }, i) => transient ? [i] : [])
    return {
      [STEP]: (a, [i, v]) => {
        joined[i] = v

        let active = argSpecs[i].active
        if (needed.has(i)) {
          needed.delete(i)
          active = true // always active when receiving first needed value
        }

        if (active && needed.size === 0) {
          a = r[STEP](a, f(...joined))
          transients.map(i => needed.add(i))
        }
        return a
      }
    }
  })

  return graph({
    nodes: {
      ...argSpecs.map((_, i) => map(x => [i, x])),
      out: joiner
    },
    links: argSpecs.map((_, i) => [$[i], $.out])
  })
}
