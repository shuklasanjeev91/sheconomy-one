/** Minimal Node `util` stub for web/native when Rolldown leaves it external. */
export function inspect(value: unknown): string {
  try {
    return typeof value === 'string' ? value : JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function format(...args: unknown[]): string {
  return args.map((arg) => (typeof arg === 'string' ? arg : inspect(arg))).join(' ')
}

export function promisify<T extends (...args: never[]) => unknown>(fn: T): T {
  return fn
}

export function inherits(_ctor: unknown, _superCtor: unknown): void {}

export function deprecate<T>(fn: T): T {
  return fn
}

export const types = {}

export default {
  inspect,
  format,
  promisify,
  inherits,
  deprecate,
  types,
}
