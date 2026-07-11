type LogLevel = 'debug' | 'info' | 'warn' | 'error'

type LogContext = Record<string, unknown>

const IS_DEV = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production'

function write(level: LogLevel, message: string, context?: LogContext) {
  if (!IS_DEV && level === 'debug') return

  const payload = context ? { message, ...context } : { message }

  switch (level) {
    case 'debug':
      console.debug('[sheconomy]', payload)
      break
    case 'info':
      console.info('[sheconomy]', payload)
      break
    case 'warn':
      console.warn('[sheconomy]', payload)
      break
    case 'error':
      console.error('[sheconomy]', payload)
      break
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => write('debug', message, context),
  info: (message: string, context?: LogContext) => write('info', message, context),
  warn: (message: string, context?: LogContext) => write('warn', message, context),
  error: (message: string, context?: LogContext) => write('error', message, context),
  apiError: (operation: string, error: string, context?: LogContext) =>
    write('error', `API ${operation} failed`, { error, ...context }),
}
