// IOGraphs are transducer graphs with the additional concept of source (input)
// and sink (output) nodes at the edges (roots and leafs) of the graph. Also,
// internal transducer nodes are augmented to catch and forward exceptions on a
// special 'err' node.

import { $ } from './pathref.js'
import { composeGraph } from './xfgraph.js'
import { first, isa } from './util.js'
import { forwardErrors, remove, keep, isXf } from './xflib.js'
import { graph, chain, isGraphable } from './graph.js'

// edge, source and sink variants
const isArray = isa(Array)
const isVariant = (type) => (x) => isArray(x) && first(x) === type
const variant = (type) => (...value) => [type, ...value]
const makeVariantFns = (type) => [isVariant(type), variant(type)]

export const [isEdge, edge] = makeVariantFns('edge')
export const [isSource, source] = makeVariantFns('source')
export const [isSink, sink] = makeVariantFns('sink')

// augmenting graphs
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
  chain(...nodes.map(augmentNode))

// IOGraph composition
const findSources = (nodes) =>
  Object.entries(nodes)
    .flatMap(([name, node]) =>
      (isGraphable(node) && isSource(node.nodes.all))
        ? [$[name].all]
        : [])

const findSinks = (nodes) =>
  Object.entries(nodes)
    .flatMap(([name, node]) =>
      isSink(node)
        ? [$[name]]
        : (isGraphable(node) && isSink(node.nodes.in))
            ? [$[name].in]
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
