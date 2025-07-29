const isDottedLiteral = (x) => /^[$a-zA-Z_][a-zA-Z0-9_]*$/.test(x)
const isIndexLiteral = (x) => /^[0-9]+$/.test(x)

/**
  * Return a string representation of a path. This is used to implement the
  * `Symbol.for('nodejs.util.inspect.custom')` method for pathRefs.

  * @param {Array} path - The path to render.
  * @returns {String} A string representation of the path.
  */
const renderPathRef = (path) =>
  '$' + path
    .map(x =>
      isDottedLiteral(x)
        ? `.${x}`
        : isIndexLiteral(x)
          ? `[${x}]`
          : `['${x}']`)
    .join('')

const pathRefs = Symbol('pathRefs')
export const newPathRef = (path) => {
  const internalObject = Object.assign((...colls) => {
    if (colls.length === 0) {
      return path
    } else {
      return colls.reduce(($, x) =>
        pathRefToArray(x)
          .reduce(($, y) => $[y], $),
        ref)
    }
  }, {
    [Symbol.toStringTag]: 'PathRef',
    [Symbol.for('nodejs.util.inspect.custom')]: (_depth, options, _inspect) =>
      options.stylize(renderPathRef(path), 'special'),
    [Symbol.toPrimitive]: () => renderPathRef(path),
    [Symbol.iterator]: () => path[Symbol.iterator](),
    [pathRefs]: new Map()
  })

  const ref = new Proxy(internalObject, {
    get: (obj, prop) => {
      if (typeof prop === 'symbol') {
        return obj[prop]
      }

      if (!obj[pathRefs].has(prop)) {
        obj[pathRefs].set(prop, newPathRef([...path, prop]))
      }
      return obj[pathRefs].get(prop)
    }
  })

  return ref
}

export const $ = newPathRef([])

export const isPathRef = (x) =>
  x instanceof Object && x[pathRefs] != null

const pathRefToArray = (x) =>
  isPathRef(x)
    ? x()
    : x

export default $
