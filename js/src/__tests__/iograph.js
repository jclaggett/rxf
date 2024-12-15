// Rules for this file
// 1. Coverage report should be at 100% when testing only this file.
// 2. Tests should be defined only in terms of the public API.

import { identity } from '../util.js'
import { spread, tag, detag } from '../xflib.js'
import { transduce, toArray } from '../reducing.js'
import { $ } from '../pathref'
import { composeIOGraph, source, sink } from '../iograph.js'

const edgeFn = (_path, [type, name]) =>
  [(type === 'source' ? detag : tag)(name)]

// Implicitly test composeIOGraph by using it to test iochain and iograph
const testGraph = (g, inputs) =>
  transduce(
    spread(composeIOGraph(g, { rootFn: edgeFn, leafFn: edgeFn }))(toArray),
    [],
    inputs)
