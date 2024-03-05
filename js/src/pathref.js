/* TODO create a custom inspector method on the Proxy object so that debug
   messages with pathRefs are more readable. challenge: derive a customized
   Proxy class.

const util = require('util')
class MyProxy {
  constructor (value, handler) {
    Object.setPrototypeOf(
      Object.getPrototypeOf(this),
      new Proxy(value, handler))
  }

  [util.inspect.custom] (depth, options, _) {
    if (depth < 0) {
      return options.stylize('[$]', 'special')
    }
    return [options.stylize('$', 'special'), ...this].join('.')
  }
}

*/

// All pathRefs defined will be stored in the following WeakMap.
const pathRefs = new WeakMap()

const newPathRef = (path) => {
  const ref = new Proxy({}, {
    get: (subpaths, name) => {
      if (!(name in subpaths)) {
        subpaths[name] = newPathRef([...path, name])
      }
      return subpaths[name]
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
 * Return a string representing a pathRef. Useful for printing but not safe to
 * evaluate since it assumes each element of the path can be a dotted literal
 * and numbers, in particular, are not viable. the returned pathRef will be a
 * subpath of the it.
 */
export const pathRefToString = (x) =>
  isPathRef(x)
    ? ['$']
        .concat(derefPathRef(x))
        .join('.')
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
