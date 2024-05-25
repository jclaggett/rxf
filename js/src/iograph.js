// IOGraphs are transducer graphs with the additional concept of source (input)
// and sink (output) nodes at the edges (roots and leafs) of the graph. Also,
// internal transducer nodes are augmented to catch and forward exceptions on a
// special 'err' node.

import { $ } from './pathref.js'
import { composeGraph } from './xfgraph.js'
import { isVariant, variant } from './util.js'
import { graph, chain } from './graph.js'

// edge, source and sink variants
export const source = variant('source')
export const isSource = isVariant('source')
export const sink = variant('sink')
export const isSink = isVariant('sink')

/**
 * Take a graph spec `g` and tranform/normalize the nodes as appropriate.
 * Currently, augmentNodes converts transducer and edge nodes into subgraphs
 * that capture errors and forward them as appropriate.
 */
export const iograph = graph

/**
 * Define an iograph as a chain of nodes
 */
export const iochain = chain

// IOGraph composition
const findSources = (nodes) =>
  Object.entries(nodes)
    .flatMap(([name, node]) =>
      isSource(node)
        ? [$[name]]
        : [])

const findSinks = (nodes) =>
  Object.entries(nodes)
    .flatMap(([name, node]) =>
      isSink(node)
        ? [$[name]]
        : [])

/**
 * Compose an iograph (i.e., a graph defined by iograph or iochain) of
 * transducers given a `rootFn` and `edgeFn`. Root and leaf nodes are found by
 * looking for toplevel source and sink nodes.
 */
export const composeIOGraph = (g, { rootFn, leafFn }) =>
  composeGraph(g, {
    rootFn,
    leafFn,
    rootPathRefs: findSources(g.nodes),
    leafPathRefs: findSinks(g.nodes)
  })
