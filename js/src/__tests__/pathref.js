import {
  $, pathRefToArray, pathRefToString, arrayToPathRef, arrayViaPathRef
} from '../pathref'

test('pathrefs', () => {
  expect(pathRefToArray($))
    .toStrictEqual([])
  expect(pathRefToArray($.a.b.c))
    .toStrictEqual(['a', 'b', 'c'])
  expect(pathRefToArray($[0][1][2]))
    .toStrictEqual(['0', '1', '2'])
  const a = $.a
  const b = a.b
  expect(a.b.c === b.c)
    .toStrictEqual(true)
  expect(pathRefToArray(a.b.c) === pathRefToArray(b.c))
    .toStrictEqual(true)
  expect(pathRefToString(a.b.c))
    .toStrictEqual('$.a.b.c')
  expect(arrayToPathRef(['a', 'b', 'c']))
    .toBe($.a.b.c)
  expect(arrayToPathRef(['a', 2, 'c']))
    .toBe($.a[2].c)
  expect(pathRefToArray(42))
    .toStrictEqual(42)
  expect(pathRefToString(true))
    .toStrictEqual(true)
  expect(arrayViaPathRef(['a', 'b', 'c']))
    .toBe(arrayViaPathRef(['a', 'b', 'c']))
})
