import {
  $, pathRefToArray, arrayToPathRef, arrayViaPathRef
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
  expect(a.b() === b())
    .toStrictEqual(true)
  expect(a.b.c())
    .toStrictEqual(['a', 'b', 'c'])
  expect(a.b.c === b.c)
    .toStrictEqual(true)
  expect(pathRefToArray(a.b.c) === pathRefToArray(b.c))
    .toStrictEqual(true)
  expect(String(a.b.c))
    .toStrictEqual('$.a.b.c')
  expect(arrayToPathRef(['a', 'b', 'c']))
    .toBe($.a.b.c)
  expect(arrayToPathRef(['a', 2, 'c']))
    .toBe($.a[2].c)
  expect(pathRefToArray(42))
    .toStrictEqual(42)
  expect(arrayViaPathRef(['a', 'b', 'c']))
    .toBe(arrayViaPathRef(['a', 'b', 'c']))
})

test('pathref as object', () => {
  expect($.a.b.c)
    .toBe($.a.b.c)
  expect($.a[2].c)
    .toBe($.a[2].c)
  expect($.a['2'].c)
    .toBe($.a[2].c)
  expect($.a[2]['c d'])
    .toBe($.a[2]['c d'])
  expect($.a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p.q.r.s.t.u.v.w.x.y.z)
    .toBe($.a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p.q.r.s.t.u.v.w.x.y.z)
})

test('pathref as array', () => {
  expect([...$])
    .toStrictEqual([])
  expect([...$.a.b.c])
    .toStrictEqual(['a', 'b', 'c'])
  expect([...$[0][1][2]])
    .toStrictEqual(['0', '1', '2'])
  expect([...$.a[2].c])
    .toStrictEqual(['a', '2', 'c'])
})

test('pathref as function', () => {
  expect($.a.b.c())
    .toStrictEqual(['a', 'b', 'c'])
  expect($.a[2].c())
    .toStrictEqual(['a', '2', 'c'])
  expect($.a['2'].c())
    .toStrictEqual(['a', '2', 'c'])
  expect($.a[2]['c d']())
    .toStrictEqual(['a', '2', 'c d'])
  expect($($.a.b, $.c))
    .toBe($.a.b.c)
  expect($.a(['b', 'c'], $.d))
    .toBe($.a.b.c.d)
})

test('pathref custom printing', () => {
  expect(`${$.a.b.c}`)
    .toStrictEqual('$.a.b.c')
  expect(`${$.a[2].c}`)
    .toStrictEqual('$.a[2].c')
  expect(`${$.a['2'].c}`)
    .toStrictEqual('$.a[2].c')
  expect(`${$.a[2]['c d']}`)
    .toStrictEqual('$.a[2][\'c d\']')

  // test custom printing
  expect($.a.b.c[Symbol.for('nodejs.util.inspect.custom')](0, { stylize: (x) => x }))
    .toStrictEqual('$.a.b.c')
})

test('pathref as iterator', () => {
  expect([...$[0][1][2]])
    .toStrictEqual(['0', '1', '2'])
  expect([...$.a.b.c])
    .toStrictEqual(['a', 'b', 'c'])
})
