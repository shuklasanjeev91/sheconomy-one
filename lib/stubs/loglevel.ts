/**
 * ESM drop-in replacement for `loglevel`.
 *
 * Upstream `loglevel` is distributed as a legacy UMD bundle that executes:
 *   (function (root, definition) { ... })(this, ...)
 * In Vite SSR (Vite 6/8 module runner), inlined modules are evaluated in strict ESM
 * where `this` is undefined and `module` is not defined. The UMD branch falls back to:
 *   root.log = definition()
 * which throws `TypeError: Cannot set properties of undefined (setting 'log')`.
 *
 * This ESM module provides full loglevel API compatibility across Vite SSR,
 * client pre-bundling, Vitest, and native bundlers.
 */

export type LogLevelNumbers = 0 | 1 | 2 | 3 | 4 | 5
export type LogLevelNames = 'trace' | 'debug' | 'info' | 'warn' | 'error'
export type LogLevelDesc = LogLevelNumbers | LogLevelNames | 'silent' | 'SILENT' | 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

export interface LogLevel {
  TRACE: 0
  DEBUG: 1
  INFO: 2
  WARN: 3
  ERROR: 4
  SILENT: 5
}

export const levels: LogLevel = {
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
  SILENT: 5,
}

export type LoggingMethod = (...message: any[]) => void
export type MethodFactory = (methodName: LogLevelNames, level: LogLevelNumbers, loggerName: string | symbol) => LoggingMethod

const noop: LoggingMethod = () => {}

const logMethods: LogLevelNames[] = ['trace', 'debug', 'info', 'warn', 'error']

function bindConsoleMethod(methodName: LogLevelNames): LoggingMethod {
  if (typeof console === 'undefined') {
    return noop
  }
  const consoleName = methodName === 'debug' ? 'log' : methodName
  const fn = (console as any)[consoleName] || (console as any).log
  if (typeof fn === 'function') {
    return fn.bind(console)
  }
  return noop
}

function defaultMethodFactory(
  methodName: LogLevelNames,
  _level: LogLevelNumbers,
  _loggerName: string | symbol
): LoggingMethod {
  return bindConsoleMethod(methodName)
}

export interface Logger {
  name: string | symbol | undefined
  readonly levels: LogLevel
  methodFactory: MethodFactory
  trace: LoggingMethod
  debug: LoggingMethod
  info: LoggingMethod
  warn: LoggingMethod
  error: LoggingMethod
  log: LoggingMethod
  getLevel: () => LogLevelNumbers
  setLevel: (level: LogLevelDesc, persist?: boolean) => void
  setDefaultLevel: (level: LogLevelDesc) => void
  resetLevel: () => void
  enableAll: (persist?: boolean) => void
  disableAll: (persist?: boolean) => void
  rebuild?: () => void
}

export interface RootLogger extends Logger {
  getLogger: (name: string | symbol) => Logger
  getLoggers: () => Record<string | symbol, Logger>
  noConflict: () => RootLogger
  default: RootLogger
}

class LoggerImpl implements Logger {
  name: string | symbol | undefined
  readonly levels = levels
  methodFactory: MethodFactory = defaultMethodFactory

  private inheritedLevel: LogLevelNumbers = levels.WARN
  private defaultLevel: LogLevelNumbers | null = null
  private userLevel: LogLevelNumbers | null = null
  private storageKey: string | undefined

  trace: LoggingMethod = noop
  debug: LoggingMethod = noop
  info: LoggingMethod = noop
  warn: LoggingMethod = noop
  error: LoggingMethod = noop
  log: LoggingMethod = noop

  constructor(name?: string | symbol, factory?: MethodFactory) {
    this.name = name
    if (factory) {
      this.methodFactory = factory
    }

    if (typeof name === 'string') {
      this.storageKey = 'loglevel:' + name
    } else if (name === undefined) {
      this.storageKey = 'loglevel'
    }

    const persisted = this.getPersistedLevel()
    if (persisted != null) {
      this.userLevel = persisted
    }

    this.rebuildMethods()
  }

  private normalizeLevel(input: LogLevelDesc): LogLevelNumbers {
    if (typeof input === 'string') {
      const upper = input.toUpperCase() as keyof LogLevel
      if (this.levels[upper] !== undefined) {
        return this.levels[upper]
      }
    }
    if (typeof input === 'number' && input >= 0 && input <= this.levels.SILENT) {
      return input as LogLevelNumbers
    }
    throw new TypeError(`log.setLevel() called with invalid level: ${input}`)
  }

  private persistLevel(levelNum: LogLevelNumbers) {
    if (typeof window === 'undefined' || !this.storageKey) return
    const levelName = (logMethods[levelNum] || 'silent').toUpperCase()
    try {
      window.localStorage?.setItem(this.storageKey, levelName)
    } catch {
      // ignore storage errors
    }
  }

  private getPersistedLevel(): LogLevelNumbers | null {
    if (typeof window === 'undefined' || !this.storageKey) return null
    try {
      const stored = window.localStorage?.getItem(this.storageKey)
      if (stored && (this.levels as any)[stored] !== undefined) {
        return (this.levels as any)[stored] as LogLevelNumbers
      }
    } catch {
      // ignore storage errors
    }
    return null
  }

  private clearPersistedLevel() {
    if (typeof window === 'undefined' || !this.storageKey) return
    try {
      window.localStorage?.removeItem(this.storageKey)
    } catch {
      // ignore storage errors
    }
  }

  private rebuildMethods() {
    const currentLevel = this.getLevel()
    for (let i = 0; i < logMethods.length; i++) {
      const methodName = logMethods[i]
      if (i < currentLevel) {
        this[methodName] = noop
      } else {
        this[methodName] = this.methodFactory(methodName, currentLevel, this.name ?? '')
      }
    }
    this.log = this.debug
  }

  getLevel(): LogLevelNumbers {
    if (this.userLevel != null) return this.userLevel
    if (this.defaultLevel != null) return this.defaultLevel
    return this.inheritedLevel
  }

  setLevel(level: LogLevelDesc, persist?: boolean) {
    this.userLevel = this.normalizeLevel(level)
    if (persist !== false) {
      this.persistLevel(this.userLevel)
    }
    this.rebuildMethods()
  }

  setDefaultLevel(level: LogLevelDesc) {
    this.defaultLevel = this.normalizeLevel(level)
    this.rebuildMethods()
  }

  resetLevel() {
    this.userLevel = null
    this.defaultLevel = null
    this.clearPersistedLevel()
    this.rebuildMethods()
  }

  enableAll(persist?: boolean) {
    this.setLevel(this.levels.TRACE, persist)
  }

  disableAll(persist?: boolean) {
    this.setLevel(this.levels.SILENT, persist)
  }

  rebuild() {
    this.rebuildMethods()
  }
}

const _loggersByName: Record<string | symbol, Logger> = {}

const defaultLogger = new LoggerImpl() as unknown as RootLogger

defaultLogger.getLogger = function getLogger(name: string | symbol): Logger {
  if ((typeof name !== 'symbol' && typeof name !== 'string') || name === '') {
    throw new TypeError('You must supply a name when creating a logger.')
  }
  let logger = _loggersByName[name]
  if (!logger) {
    logger = _loggersByName[name] = new LoggerImpl(name, defaultLogger.methodFactory)
  }
  return logger
}

defaultLogger.getLoggers = function getLoggers(): Record<string | symbol, Logger> {
  return _loggersByName
}

defaultLogger.noConflict = function noConflict(): RootLogger {
  return defaultLogger
}

defaultLogger.default = defaultLogger

// Default export
export default defaultLogger

// Named exports forwarding root logger methods
export const getLogger = defaultLogger.getLogger.bind(defaultLogger)
export const getLoggers = defaultLogger.getLoggers.bind(defaultLogger)
export const noConflict = defaultLogger.noConflict.bind(defaultLogger)
export const getLevel = defaultLogger.getLevel.bind(defaultLogger)
export const setLevel = defaultLogger.setLevel.bind(defaultLogger)
export const setDefaultLevel = defaultLogger.setDefaultLevel.bind(defaultLogger)
export const resetLevel = defaultLogger.resetLevel.bind(defaultLogger)
export const enableAll = defaultLogger.enableAll.bind(defaultLogger)
export const disableAll = defaultLogger.disableAll.bind(defaultLogger)
export const trace: LoggingMethod = (...args) => defaultLogger.trace(...args)
export const debug: LoggingMethod = (...args) => defaultLogger.debug(...args)
export const info: LoggingMethod = (...args) => defaultLogger.info(...args)
export const warn: LoggingMethod = (...args) => defaultLogger.warn(...args)
export const error: LoggingMethod = (...args) => defaultLogger.error(...args)
export const log: LoggingMethod = (...args) => defaultLogger.log(...args)
export const methodFactory = defaultLogger.methodFactory
