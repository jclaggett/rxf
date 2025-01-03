// Reducer Protocol as described by:
// https://github.com/cognitect-labs/transducers-js#the-transducer-protocol
//
// This transducer implementation leverages prototype inheritance to provide
// default behavior for the new reducer by inheriting methods from of the old
// reducer. Reasons for this approach:
// 1. Prototype inheritance is a low level and optimized javascript feature.
// 2. The constructor doesn't define proxying INIT, STEP, and RESULT methods.

import { derive } from './util.js'

export const INIT = '@@transducer/init'
export const STEP = '@@transducer/step'
export const RESULT = '@@transducer/result'
export const REDUCED = '@@transducer/reduced'
export const VALUE = '@@transducer/value'

export const reduced = (x) => ({ [REDUCED]: true, [VALUE]: x })
export const unreduced = (x) => x[VALUE]
export const isReduced = (x) => x instanceof Object && x[REDUCED] === true
export const ensureReduced = (x) => isReduced(x) ? x : reduced(x)
export const ensureUnreduced = (x) => isReduced(x) ? unreduced(x) : x

// Convenience builder for transducers. Takes an xf function which implements
// the transducer (taking and returing a reducer). The returned reducer then
// derives any unimplemented parts of the reducing protocol from the given
// reducer (using prototype inheritance).
export const transducer = (xf) =>
  (reducer) => derive(xf(reducer), reducer)

// A reduce function that stops early when receiving a reduced value.
export const reduce = (f, a, vs) => {
  for (const v of vs) {
    a = f(a, v)
    if (isReduced(a)) break
  }
  return a
}

// Like reduce but with a reducer instead of a reducing function
export const transduce = (r, a, vs) =>
  r[RESULT](ensureUnreduced(reduce(r[STEP], a, vs)))

// reducers

export const nullReducer = {
  [INIT]: () => null,
  [STEP]: (_a, _x) => null,
  [RESULT]: (_a) => null
}

export const toArray = {
  [INIT]: () => [],
  [STEP]: (a, x) => {
    a.push(x)
    return a
  },
  [RESULT]: (a) => a
}

export const sum = {
  [INIT]: () => 0,
  [STEP]: (a, x) => a + x,
  [RESULT]: (a) => a
}

export const count = {
  [INIT]: () => 0,
  [STEP]: (a, _x) => a + 1,
  [RESULT]: (a) => a
}

export const average = {
  [INIT]: () => ({ total: 0, count: 0 }),
  [STEP]: (a, x) => {
    a.total += x
    a.count += 1
    return a
  },
  [RESULT]: (a) => a.total / a.count
}
