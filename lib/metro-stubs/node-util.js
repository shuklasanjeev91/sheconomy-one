/** Minimal Node `util` stub for Hermes (LiveKit / debug deps). */
function inspect(value) {
  try {
    return typeof value === 'string' ? value : JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function format(...args) {
  return args.map((arg) => (typeof arg === 'string' ? arg : inspect(arg))).join(' ')
}

function promisify(fn) {
  return function promisified(...args) {
    return new Promise((resolve, reject) => {
      try {
        fn(...args, (err, result) => (err ? reject(err) : resolve(result)))
      } catch (error) {
        reject(error)
      }
    })
  }
}

function inherits(ctor, superCtor) {
  if (!ctor || !superCtor) return
  ctor.super_ = superCtor
  Object.setPrototypeOf(ctor.prototype, superCtor.prototype)
}

function deprecate(fn) {
  return fn
}

module.exports = {
  inspect,
  format,
  promisify,
  inherits,
  deprecate,
  types: {},
  TextEncoder: typeof TextEncoder !== 'undefined' ? TextEncoder : undefined,
  TextDecoder: typeof TextDecoder !== 'undefined' ? TextDecoder : undefined,
}
