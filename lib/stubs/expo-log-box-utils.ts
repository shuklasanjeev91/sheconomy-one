/**
 * ESM stub for `@expo/log-box/utils`.
 * The published package entry is CJS (`module.exports = require(...)`),
 * which blows up Vite's SSR module runner with `module is not defined`.
 * Only `withoutANSIColorStyles` is needed by `expo/async-require` on web.
 */

export function withoutANSIColorStyles<T>(message: T): T {
  if (typeof message !== 'string') return message
  return message.replace(
    // eslint-disable-next-line no-control-regex
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    '',
  ) as T
}

export function parseWebBuildErrors(input: unknown): unknown {
  return input
}
