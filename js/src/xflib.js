// Library of transducers. The only rule for inclusion is that these
// transducers may be composed freely and don't export non-transducer
// functions. This is why the joining transducers are excluded.

import {
  STEP, RESULT,
  transducer, isReduced, reduced, ensureReduced, ensureUnreduced, reduce
} from './reducing.js'
import { compose, identity, first, second, rest, last, isa } from './util.js'

// Transducer Protocol: for now, any function is a transducer
export const isXf = isa(Function)

// mapcat: call `f` with current value and stepping through all returned values
export const mapcat = (f) =>
  transducer(r => {
    return {
      [STEP]: (a, v) =>
        reduce((a, v) =>
          isReduced(v)
            ? reduced(a)
            : r[STEP](a, v),
        a,
        f(v))
    }
  })
export const flatMap = mapcat

export const reductions = (reducer, initializer) =>
  transducer(r => {
    let stepNeverCalled = true
    let state = initializer() // use a thunk to reduce the odds of state leaking
    return {
      [STEP]: (a, v) => {
        if (stepNeverCalled) {
          stepNeverCalled = false
          a = r[STEP](a, state)
          if (!isReduced(a)) {
            state = reducer(state, v)
            a = r[STEP](a, state)
          }
        } else {
          state = reducer(state, v)
          a = r[STEP](a, state)
        }
        return a
      },
      [RESULT]: (a) =>
        r[RESULT](stepNeverCalled
          ? ensureUnreduced(r[STEP](a, state))
          : a)
    }
  })

// map: call `f` with current value and stepping through returned value
export const map = (f) =>
  mapcat(v => [f(v)])

// emit: constantly return x for every step
export const emit = (c) =>
  map(_ => c)

export const trailing = (n) =>
  compose(
    reductions((a, v) => {
      a = (a.length < n)
        ? [...a]
        : rest(a)
      a.push(v)
      return a
    }, () => []),
    drop(1))

// filter: Step only if `pred(v)` is true.
export const filter = (pred) =>
  mapcat(v => pred(v) ? [v] : [])

// keep: alias for filter
export const keep = filter

// remove: Step only if `pred(v)` is false.
export const remove = (pred) =>
  filter(x => !pred(x))

// filter2: Step if `pred(v0, v1)` is true. Always step through first value.
export const filter2 = (pred) =>
  compose(
    trailing(2),
    filter(vs => vs.length < 2 || pred(...vs)),
    map(last))

// dedupe: Step if the current value is different from the previous value.
export const dedupe = () =>
  filter2((x, y) => x !== y)

// partition: Step width sized groups of values and every stride.
export const partition = (width, stride) => {
  width = width < 0 ? 0 : width
  stride = stride < 1 ? 1 : stride

  return compose(
    reductions((state, v) => {
      state.result = []
      state.i = (state.i + 1) % stride
      if (state.i >= (stride - width)) {
        state.buffer.push(v)
        if (state.buffer.length === width) {
          state.result.push(state.buffer)
          state.buffer = state.buffer.slice(stride)
        }
      }
      return state
    }, () => ({
      result: null,
      i: stride - width - 1,
      buffer: []
    })),
    drop(1),
    mapcat(state => state.result))
}

// dropAll: ignore all steps
export const dropAll =
  mapcat(_ => [])

// take: only step `n` times.
export const take = (n) =>
  (n < 1)
    ? dropAll
    : compose(
      reductions((a, v) => {
        a.vs[0] = v
        if (++a.i >= n) {
          a.vs.push(reduced(null))
        }
        return a
      }, () => ({
        i: 0,
        vs: []
      })),
      mapcat(a => a.vs))

// takeWhile: only step through while `pred(v)` is true.
export const takeWhile = (pred) =>
  mapcat(v => [pred(v) ? v : reduced(null)])

// takeAll: step through all values given
export const takeAll = identity

// drop: do not step `n` times.
export const drop = (n) =>
  (n < 1)
    ? takeAll
    : compose(
      reductions((a, v) => {
        if (++a.i > n) {
          a.vs[0] = v
        }
        return a
      }, () => ({
        i: 0,
        vs: []
      })),
      mapcat(a => a.vs)
    )

// dropWhile: do not step until `pred(v)` is false.
export const dropWhile = (pred) =>
  compose(
    reductions((a, v) => {
      a.stillDropping = a.stillDropping && pred(v)
      if (!a.stillDropping) {
        a.vs[0] = v
      }
      return a
    }, () => ({
      stillDropping: true,
      vs: []
    })),
    mapcat(a => a.vs))

// interpose: Step with sep between each value.
export const interpose = (sep) =>
  compose(
    mapcat(x => [sep, x]),
    drop(1))

// prolog & epilog: step an initial value before first step and a final value
// after last step.
export const prolog = (x) =>
  reductions((_, v) => v, () => x)

export const epilog = (x) =>
  transducer(r => {
    let stepWasReduced = false
    return {
      [STEP]: (a, v) => {
        a = r[STEP](a, v)
        stepWasReduced = isReduced(a)
        return a
      },
      [RESULT]: (a) =>
        r[RESULT](stepWasReduced ? a : ensureUnreduced(r[STEP](a, x)))
    }
  })

// after: step `x` after dropping all values.
export const after = (x) =>
  compose(
    dropAll,
    epilog(x))

// tag & detag tranducers
export const tag = (k) =>
  compose(
    map(x => [k, x]),
    epilog([k]))

export const detag = (k) =>
  compose(
    filter(x => x instanceof Array && x.length > 0 && first(x) === k),
    takeWhile(x => x.length === 2),
    map(second))

// spread & merge tranducers
// NOTE: merge assumes that the standard reducing protocol is broken! It
// assumes that, instead of only one parent transducer, it may have multiple
// (n) parent transducers. This means it will accept [STEP] calls even after a
// reduced() value is returned and it expects to receive multiple (n) [RESULT]
// calls.
export const spread = (xfs) =>
  // There are 4 layers of reducers in spread:
  // r1: the given, next reducer in the chain
  // r2: a merge reducer over r1
  // rs: the spread reducers all sharing r2
  // returned reducer: applies all rs reducers
  (xfs.length === 0)
    ? dropAll // trivial case: zero transducers to spread
    : (xfs.length === 1)
        ? xfs[0] // trivial case: no need to spread to only one transducer
        : transducer(r1 => {
          const r2 = merge(xfs.length)(r1)
          let rs = xfs.map(xf => xf(r2))
          return {
            [STEP]: (a, v) => {
              a = rs.reduce(
                (a, r, i) => {
                  a = r[STEP](a, v)
                  if (isReduced(a)) {
                    rs[i] = null
                    a = r[RESULT](ensureUnreduced(a))
                  }
                  return a
                },
                a)
              rs = rs.filter(x => x != null)
              if (rs.length === 0) {
                a = ensureReduced(a)
              }
              return a
            },

            [RESULT]: (a) =>
              rs.reduce((a, r) => r[RESULT](a), a)
          }
        })

export const merge = (n) => {
  if (n < 2) {
    return takeAll // trivial case
  } else {
    let expectedResultCalls = n
    let sharedReducer = null
    let reducedValue = null
    return transducer(r => {
      if (sharedReducer == null) {
        sharedReducer = {
          [STEP]: (a, v) => {
            if (reducedValue != null) {
              a = reducedValue
            } else {
              a = r[STEP](a, v)
              if (isReduced(a)) {
                reducedValue = a
              }
            }
            return a
          },

          [RESULT]: (a) => {
            if (--expectedResultCalls <= 0) {
              a = r[RESULT](a)
            }
            return a
          }
        }
      }
      return sharedReducer
    })
  }
}

// forwardErrors: catch any errors that occur when stepping through
// the reducer defined by `xf` and forward those errors bypassing `xf`.
export const forwardErrors = (xf) =>
  transducer(r1 => {
    const r2 = xf(r1)

    return {
      [STEP]: (a, v) => {
        try {
          return r2[STEP](a, v)
        } catch (error) {
          return r1[STEP](a, error)
        }
      }
    }
  })
