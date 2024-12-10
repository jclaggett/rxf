// Light weight library with several basic functions.
// Heavily inspired by LISP and Clojure.
// Must not depend on any other module.

/**
  * Returns x itself.
  * @param {any} x
  * @returns {any}
  * @example
  * identity(42) // 42
  * identity('foo') // 'foo'
  * identity([1, 2, 3]) // [1, 2, 3]
  */
export const identity = (x) => x

/**
  * Returns the first element of x.
  * @param {Array} x
  * @returns {any}
  * @example
  * first([1, 2, 3]) // 1
  * first(['foo', 'bar', 'baz']) // 'foo'
  * first([]) // undefined
  */
export const first = (x) => x[0]

/**
  * Returns the second element of x.
  * @param {Array} x
  * @returns {any}
  * @example
  * second([1, 2, 3]) // 2
  * second(['foo', 'bar', 'baz']) // 'bar'
  * second([]) // undefined
  */
export const second = (x) => x[1]

/**
  * Returns the last element of x.
  * @param {Array} x
  * @returns {any}
  * @example
  * last([1, 2, 3]) // 3
  * last(['foo', 'bar', 'baz']) // 'baz'
  * last([]) // undefined
  */
export const last = (x) => x[x.length - 1]

/**
  * Returns all elements of x except the first one.
  * @param {Array} x
  * @returns {Array}
  * @example
  * rest([1, 2, 3]) // [2, 3]
  * rest(['foo', 'bar', 'baz']) // ['bar', 'baz']
  * rest([]) // []
  */
export const rest = (x) => x.slice(1)

/**
  * Returns all elements of x except the last one.
  * @param {Array} x
  * @returns {Array}
  * @example
  * butLast([1, 2, 3]) // [1, 2]
  * butLast(['foo', 'bar', 'baz']) // ['foo', 'bar']
  * butLast([]) // []
  */
export const butLast = (x) => x.slice(0, -1)

/**
  * Returns true when x is an empty array.
  * @param {Array} x
  * @returns {boolean}
  * @example
  * isEmpty([]) // true
  * isEmpty([1, 2, 3]) // false
  */
export const isEmpty = (x) => x.length === 0

/**
  * Returns a function that composes all functions in fs and applies them to x
  * in right to left order.
  * @param {Array<Function>} fs
  * @returns {Function}
  * @example
  * const f = compose(x => x + 1, x => x * 2)
  * f(3) // 7
  * f(4) // 9
  */
export const compose = (...fs) => (x) => fs.reduceRight((x, f) => f(x), x)

/**
  * Alias for Object.setPrototypeOf. Used to 'derive' one object from another so
  * that properties from the derived object are inherited by the returned
  * object. Handles the special case where x and y are the same.
  * @param {Object} x
  * @param {Object} y
  * @returns {Object}
  * @example
  * const x = { a: 1 }
  * const y = { b: 2 }
  * const z = derive(x, y)
  * z.a // 1
  * z.b // 2
  * z.__proto__ === y // true
  */
export const derive = (x, y) =>
  x === y
    ? x
    : Object.setPrototypeOf(x, y)

/**
  * Returns a predicate that returns true when x is equal to any value in `xs`.
  * @param {Array} xs
  * @returns {Function}
  * @example
  * const isOneOf = contains(1, 2, 3)
  * isOneOf(1) // true
  * isOneOf(2) // true
  * isOneOf(4) // false
  */
export const contains = (...xs) => {
  const o = Object.fromEntries(xs.map(x => [x, true]))
  return x => o[x] || false
}

/**
  * Returns a predicate that returns true when x is not equal to any value in `xs`.
  * @param {Array} xs
  * @returns {Function}
  * @example
  * const isNotOneOf = excludes(1, 2, 3)
  * isNotOneOf(1) // false
  * isNotOneOf(2) // false
  * isNotOneOf(4) // true
  */
export const excludes = (...xs) => compose(x => !x, contains(...xs))

/**
  * Returns a predicate that returns true when x is an instance of `y`.
  * @param {object} y
  * @returns {Function}
  * @example
  * const isObject = isa(Object)
  * isObject({}) // true
  * isObject([]) // false
  * isObject(42) // false
  */
export const isa = (y) => (x) => (x instanceof y)

/**
  * Returns true when x is an array.
  * @param {any} x
  * @returns {boolean}
  * @example
  * isArray([]) // true
  * isArray([1, 2, 3]) // true
  * isArray('foo') // false
  * isArray(42) // false
  */
export const isArray = isa(Array)

/**
  * Returns a predicate that is true when x is a variant of `type`.
  *
  * A variant is an array where the first element is `type` followed by an
  * optional secondary value.
  *
  * @param {string} type
  * @returns {Function}
  * @example
  * const isFoo = isVariant('foo')
  * isFoo(['foo']) // true
  * isFoo(['foo', 42]) // true
  * isFoo(['bar']) // false
  * isFoo(42) // false
  */
export const isVariant = (type) => (x) => isArray(x) && first(x) === type

/**
  * Returns a variant constructor that returns variants of `type`.
  *
  * A variant is an array where the first element is `type` followed by an
  * optional secondary value.
  *
  * @param {string} type
  * @returns {Function}
  * @example
  * const foo = variant('foo')
  * foo() // ['foo']
  * foo(42) // ['foo', 42]
  * foo('bar') // ['foo', 'bar']
  */
export const variant = (type) => (...values) => [type, ...values]

/**
  * Debugging function that logs the type and value of `x`. Returns `x`
  * unchanged.
  * @param {any} x
  * @returns {any}
  * @example
  * debug(42) // logs ['number', 42]
  * debug('foo') // logs ['string', 'foo']
  */
export const debug = (x) => {
  console.dir([typeof x, x], { colors: true, depth: 5 })
  return x
}
