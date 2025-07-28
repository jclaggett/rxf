// All pathRefs defined will be stored in the following WeakMap.
const pathRefs = new WeakMap()

const isDottedLiteral = (x) => /^[$a-zA-Z_][a-zA-Z0-9_]*$/.test(x)
const isIndexLiteral = (x) => /^[0-9]+$/.test(x)

/**
  * Return a string representation of a path. This is used to implement the
  * `Symbol.for('nodejs.util.inspect.custom')` method for pathRefs.

  * @param {Array} path - The path to render.
  * @returns {String} A string representation of the path.
  */
const renderPath = (path) =>
  '$' + path
    .map(x =>
      isDottedLiteral(x)
        ? `.${x}`
        : isIndexLiteral(x)
          ? `[${x}]`
          : `['${x}']`)
    .join('')

const newPathRef = (path) => {
  const internalObject = Object.assign(() => path, {
    [Symbol.toStringTag]: 'PathRef',
    [Symbol.for('nodejs.util.inspect.custom')]: (_depth, options, _inspect) =>
      options.stylize(renderPath(path), 'special'),
    [Symbol.toPrimitive]: () => renderPath(path),
    [Symbol.iterator]: () => path[Symbol.iterator](),
  })

  const ref = new Proxy(internalObject, {
    get: (subpaths, prop) => {
      if (!(prop in subpaths)) {
        subpaths[prop] = newPathRef([...path, prop])
      }
      return subpaths[prop]
    }
  })

  pathRefs.set(ref, path)
  return ref
}

export const $ = newPathRef([])

export const isPathRef = (x) =>
  pathRefs.has(x)

export const derefPathRef = (x) =>
  pathRefs.get(x)

export const pathRefToArray = (x) =>
  isPathRef(x)
    ? derefPathRef(x)
    : x

/**
 * Return a pathRef equivilent to the given array. If `pathRef` is specified,
 * the returned pathRef will be a subpath of the it.
 */
export const arrayToPathRef = ([name, ...path], pathRef = $) =>
  (name == null)
    ? pathRef
    : arrayToPathRef(path, pathRef[name])

/**
 * Return an array with the same elements as those contained in `x`. The
 * returned array will be cached as a pathRef and so will be identical (i.e.,
 * `x===y`) to other pathRef arrays with the same values.
 */
export const arrayViaPathRef = (x, pathRef = $) =>
  pathRefToArray(arrayToPathRef(x, pathRef))

export default $
