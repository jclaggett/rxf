// Rules for this file
// 1. Coverage report should be at 100% when testing only this file.
// 2. Tests should be defined only in terms of the exported API.

import { jest } from '@jest/globals'
import * as util from '../util'

beforeAll(() => {
  console.dir = jest.fn()
})

test('util fns work', () => {
  const data = [1, 2, 3]
  expect(util.isEmpty(data))
    .toStrictEqual(false)
  expect(util.identity(data))
    .toStrictEqual(data)
  expect(util.first(data))
    .toStrictEqual(1)
  expect(util.second(data))
    .toStrictEqual(2)
  expect(util.last(data))
    .toStrictEqual(3)
  expect(util.rest(data))
    .toStrictEqual([2, 3])
  expect(util.butLast(data))
    .toStrictEqual([1, 2])
  expect(util.compose()(data))
    .toStrictEqual([1, 2, 3])
  expect(util.compose(util.last, util.butLast)(data))
    .toStrictEqual(2)
  const c = util.contains(1, 2, 3)
  expect(c(1))
    .toStrictEqual(true)
  expect(c(4))
    .toStrictEqual(false)
  const e = util.excludes(1, 2, 3)
  expect(e(1))
    .toStrictEqual(false)
  expect(e(4))
    .toStrictEqual(true)
  const isOne = util.isVariant(1)
  const one = util.variant(1)
  expect(isOne(one(2)))
    .toStrictEqual(true)
  expect(isOne(one()))
    .toStrictEqual(true)
  expect(util.isa(Object)({}))
    .toStrictEqual(true)
  expect(util.debug(42))
    .toStrictEqual(42)
})
