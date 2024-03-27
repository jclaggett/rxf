// Rules for this file
// 1. Coverage report should be at 100% when testing only this file.
// 2. Tests should be defined only in terms of the exported API.

import {
  INIT, STEP, RESULT, isReduced, unreduced, reduced, transducer,
  transduce, nullReducer, count, toArray, average,
  ensureReduced, ensureUnreduced, sum, reduce
} from '../reducing'

test('reducing protocol fns work', () => {
  expect(isReduced(42))
    .toStrictEqual(false)
  expect(isReduced(reduced(42)))
    .toStrictEqual(true)
  expect(isReduced(ensureReduced(42)))
    .toStrictEqual(true)
  expect(isReduced(ensureReduced(reduced(42))))
    .toStrictEqual(true)
  expect(isReduced(unreduced(ensureReduced(reduced(42)))))
    .toStrictEqual(false)
  expect(isReduced(ensureUnreduced(ensureReduced(reduced(42)))))
    .toStrictEqual(false)
  expect(isReduced(ensureUnreduced(unreduced(ensureReduced(reduced(42))))))
    .toStrictEqual(false)
})

test('reduce fn works', () => {
  expect(reduce((a, x) => a + x, 0, [1, 2, 3]))
    .toStrictEqual(6)
  expect(unreduced(reduce((a, x) => reduced(a + x), 0, [1, 2, 3])))
    .toStrictEqual(1)
})

test('transducing fn works', () => {
  const xf = transducer(r => ({
    [INIT]: r[INIT],
    [STEP]: r[STEP],
    [RESULT]: r[RESULT]
  }))

  const r1 = {
    [INIT]: () => 0,
    [STEP]: (a, v) => a + v,
    [RESULT]: (a) => a
  }

  const r2 = xf(r1)

  expect(r2[INIT]())
    .toStrictEqual(0)
  expect(r2[STEP](0, 1))
    .toStrictEqual(1)
  expect(r2[RESULT](1))
    .toStrictEqual(1)

  expect(transducer(r => r)(r1))
    .toBe(r1)
})

test('reducers work', () => {
  const data = [1, 2, 3]
  expect(transduce(nullReducer, nullReducer[INIT](), data))
    .toStrictEqual(null)
  expect(transduce(toArray, toArray[INIT](), data))
    .toStrictEqual([1, 2, 3])
  expect(transduce(count, count[INIT](), data))
    .toStrictEqual(3)
  expect(transduce(average, average[INIT](), data))
    .toStrictEqual(2)
  expect(transduce(sum, sum[INIT](), data))
    .toStrictEqual(6)
})
