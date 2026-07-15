type LogLevel = 'info' | 'warn' | 'error'

/**
 * OTA logging — verbose in development; production keeps a short breadcrumb
 * that never throws (extend later to Sentry / existing logger).
 */
export function logUpdate(level: LogLevel, message: string, extra?: unknown): void {
  const isDev =
    (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') ||
    (typeof __DEV__ !== 'undefined' && __DEV__)

  if (!isDev && level === 'info') return

  const payload = extra === undefined ? message : `${message} ${safeStringify(extra)}`
  try {
    if (level === 'error') console.error('[ota]', payload)
    else if (level === 'warn') console.warn('[ota]', payload)
    else console.log('[ota]', payload)
  } catch {
    // never throw from logging
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}
