const dottedLiteralRegex = /^[_$a-zA-Z][_$a-zA-Z0-9]*$/
const indexLiteralRegex = /^[0-9]+$/

/**
  * Return a string representation of a path. This is used to implement the
  * `Symbol.for('nodejs.util.inspect.custom')` method for pathRefs.

  * @param {Array} path - The path to render.
  * @returns {String} A string representation of the path.
  */
const pathRefToString = (path) =>
  '$' + path
    .map(x =>
      dottedLiteralRegex.test(x)
        ? `.${x}`
        : indexLiteralRegex.test(x)
          ? `[${x}]`
          : `['${x}']`)
    .join('')

const pathRefs = Symbol('pathRefs')

export const isPathRef = (x) =>
  x instanceof Object && x[pathRefs] != null

const createPathRef = (path) => {
  const internalObject = Object.assign((...colls) => {
    if (colls.length === 0) {
      return path
    } else {
      return colls.reduce(($, x) => {
        x = isPathRef(x) ? x() : x
        if (Array.isArray(x)) {
          return x.reduce(($, y) => $[y], $)
        } else {
          throw new TypeError(`PathRef called with non-array argument: ${x} (type: ${typeof x})`)
        }
      },
        ref)
    }
  }, {
    [Symbol.toStringTag]: 'PathRef',
    [Symbol.for('nodejs.util.inspect.custom')]: (_depth, options, _inspect) =>
      options.stylize(pathRefToString(path), 'special'),
    [Symbol.toPrimitive]: () => pathRefToString(path),
    [Symbol.iterator]: () => path[Symbol.iterator](),
    [pathRefs]: new Map()
  })

  const ref = new Proxy(internalObject, {
    get: (obj, prop) => {
      if (typeof prop === 'symbol') {
        return obj[prop]
      }

      if (!obj[pathRefs].has(prop)) {
        obj[pathRefs].set(prop, createPathRef([...path, prop]))
      }
      return obj[pathRefs].get(prop)
    }
  })

  return ref
}

export const createRoot = () =>
  createPathRef([])
export const $ = createRoot()
export default $
