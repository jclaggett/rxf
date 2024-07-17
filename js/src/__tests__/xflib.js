// Rules for this file
// 1. Coverage report should be at 100% when testing only this file.
// 2. Tests should be defined only in terms of the public API.

import { transduce, toArray } from '../reducing'
import { compose } from '../util'
import {
  after,
  dedupe,
  merge,
  detag,
  drop,
  dropAll,
  dropWhile,
  emit,
  append,
  filter,
  filter2,
  flatMap,
  forwardErrors,
  interpose,
  keep,
  map,
  spread,
  partition,
  prepend,
  reductions,
  remove,
  tag,
  take,
  takeWhile,
  trailing
} from '../xflib'

const data = [1, 2, 3]
const data2 = [1, 2, 2, 3, 2]

const T = (xf, data) =>
  transduce(xf(toArray), [], data)

test('flatMap works', () => {
  expect(T(flatMap(x => [x + 1, -x]), data))
    .toStrictEqual([2, -1, 3, -2, 4, -3])
})

test('map works', () => {
  expect(T(map(x => x + 1), data))
    .toStrictEqual([2, 3, 4])
})

test('emit works', () => {
  expect(T(emit(1), data))
    .toStrictEqual([1, 1, 1])
})

test('reductions works', () => {
  expect(T(reductions((x, y) => x + y, () => 0), data))
    .toStrictEqual([0, 1, 3, 6])
})

test('filter works', () => {
  expect(T(filter(x => x % 2), data))
    .toStrictEqual([1, 3])
})

test('keep works', () => {
  expect(T(keep(x => x % 2), data))
    .toStrictEqual([1, 3])
})

test('remove works', () => {
  expect(T(remove(x => x % 2), data))
    .toStrictEqual([2])
})

test('partition works', () => {
  expect(T(partition(-1, 0), data))
    .toStrictEqual([])
  expect(T(partition(0, 1), data))
    .toStrictEqual([])
  expect(T(partition(2, 0), data))
    .toStrictEqual([[1, 2], [2, 3]])
  expect(T(partition(2, 1), data))
    .toStrictEqual([[1, 2], [2, 3]])
  expect(T(partition(2, 2), [1, 2, 3, 4, 5]))
    .toStrictEqual([[1, 2], [3, 4]])
  expect(T(partition(2, 3), [1, 2, 3, 4, 5]))
    .toStrictEqual([[1, 2], [4, 5]])
  expect(T(partition(2), [1, 2, 3, 4, 5]))
    .toStrictEqual([[1, 2], [3, 4]])
})

test('trailing works', () => {
  expect(T(trailing(2), data))
    .toStrictEqual([[1], [1, 2], [2, 3]])
})

test('filter2 works', () => {
  expect(T(filter2((x, y) => x < y), data2))
    .toStrictEqual([1, 2, 3])
})

test('dedupe works', () => {
  expect(T(dedupe(), data2))
    .toStrictEqual([1, 2, 3, 2])
})

test('prolog works', () => {
  expect(T(prepend(42), data))
    .toStrictEqual([42, 1, 2, 3])
  expect(T(compose(prepend(42), take(1)), data))
    .toStrictEqual([42])
  expect(T(prepend(42), []))
    .toStrictEqual([42])
})

test('epilog works', () => {
  expect(T(append(42), data))
    .toStrictEqual([1, 2, 3, 42])
  expect(T(append(42), []))
    .toStrictEqual([42])
  expect(T(compose(append(42), take(2)), [1, 2, 3]))
    .toStrictEqual([1, 2])
})

test('take works', () => {
  expect(T(take(-1), data))
    .toStrictEqual([])
  expect(T(take(0), data))
    .toStrictEqual([])
  expect(T(take(2), data))
    .toStrictEqual([1, 2])
})

test('takeWhile works', () => {
  expect(T(takeWhile(x => x < 2), data))
    .toStrictEqual([1])
})

test('drop works', () => {
  expect(T(drop(-1), data))
    .toStrictEqual(data)
  expect(T(drop(0), data))
    .toStrictEqual(data)
  expect(T(drop(2), data))
    .toStrictEqual([3])
})

test('dropWhile works', () => {
  expect(T(dropWhile(x => x < 2), data))
    .toStrictEqual([2, 3])
})

test('dropAll works', () => {
  expect(T(dropAll, data))
    .toStrictEqual([])
})

test('interpose works', () => {
  expect(T(interpose(0), data))
    .toStrictEqual([1, 0, 2, 0, 3])
})

test('after works', () => {
  expect(T(after(42), data))
    .toStrictEqual([42])
})

test('tag works', () => {
  expect(T(tag(true), data))
    .toStrictEqual([[true, 1], [true, 2], [true, 3], [true]])
})

test('detag works', () => {
  expect(T(detag(true), data))
    .toStrictEqual([])
  expect(T(compose(tag(true), detag(true)), data))
    .toStrictEqual([1, 2, 3])
})

test('spread works', () => {
  expect(T(spread([]), data))
    .toStrictEqual([])
  expect(T(spread([map(x => x + 1)]), data))
    .toStrictEqual([2, 3, 4])
  expect(T(spread([map(x => -x), take(2)]), data))
    .toStrictEqual([-1, 1, -2, 2, -3])
})

test('merge works', () => {
  expect(T(compose(merge(1), map(x => x + 1)), data))
    .toStrictEqual([2, 3, 4])

  const tail = compose(merge(2), take(3))
  expect(T(spread([tail, tail]), data))
    .toStrictEqual([1, 1, 2])
})

test('forwardErrors works', () => {
  expect(T(forwardErrors(map(x => x)), data))
    .toStrictEqual([1, 2, 3])

  expect(T(forwardErrors(map(x => { throw new Error(x) })), data))
    .toStrictEqual(data.map(x => new Error(x)))
})
