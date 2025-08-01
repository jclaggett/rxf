const dottedLiteralRegex = /^[_$a-zA-Z][_$a-zA-Z0-9]*$/
const indexLiteralRegex = /^[0-9]+$/

/**
  * Return string representation of a data path.

  * @param {Array} path - The path to render.
  * @returns {String} A string representation of the path.
  */
const dataPathToString = (path) =>
  '$' + path
    .map(x =>
      dottedLiteralRegex.test(x)
        ? `.${x}`
        : indexLiteralRegex.test(x)
          ? `[${x}]`
          : `['${x}']`)
    .join('')

const dataPaths = Symbol('dataPaths')

export const isDataPath = (x) =>
  x instanceof Object && x[dataPaths] != null

const createDataPath = (path) => {
  const internalObject = Object.assign((...colls) => {
    if (colls.length === 0) {
      return path
    } else {
      return colls.reduce(($, x) => {
        x = isDataPath(x) ? x() : x
        if (Array.isArray(x)) {
          return x.reduce(($, y) => $[y], $)
        } else {
          throw new TypeError(`DataPath called with non-array argument: ${x} (type: ${typeof x})`)
        }
      },
        ref)
    }
  }, {
    [Symbol.toStringTag]: 'DataPath',
    [Symbol.for('nodejs.util.inspect.custom')]: (_depth, options, _inspect) =>
      options.stylize(dataPathToString(path), 'special'),
    [Symbol.toPrimitive]: () => dataPathToString(path),
    [Symbol.iterator]: () => path[Symbol.iterator](),
    [dataPaths]: new Map()
  })

  const ref = new Proxy(internalObject, {
    get: (obj, prop) => {
      if (typeof prop === 'symbol') {
        return obj[prop]
      }

      if (!obj[dataPaths].has(prop)) {
        obj[dataPaths].set(prop, createDataPath([...path, prop]))
      }
      return obj[dataPaths].get(prop)
    }
  })

  return ref
}

export const createRoot = () =>
  createDataPath([])
export const $ = createRoot()
export default $
