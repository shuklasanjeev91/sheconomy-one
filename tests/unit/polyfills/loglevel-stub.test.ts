import { describe, expect, it } from 'vitest'
import loglevel, { getLogger, levels, setLevel } from '~/lib/stubs/loglevel'

describe('loglevel ESM stub', () => {
  it('exports default root logger and named helpers', () => {
    expect(loglevel).toBeDefined()
    expect(typeof loglevel.getLogger).toBe('function')
    expect(typeof getLogger).toBe('function')
    expect(levels).toBeDefined()
    expect(levels.WARN).toBe(3)
    expect(levels.DEBUG).toBe(1)
  })

  it('creates named loggers with logging methods', () => {
    const logger = loglevel.getLogger('test-logger')
    expect(logger).toBeDefined()
    expect(logger.name).toBe('test-logger')
    expect(typeof logger.trace).toBe('function')
    expect(typeof logger.debug).toBe('function')
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.error).toBe('function')
    expect(typeof logger.setLevel).toBe('function')
  })

  it('caches named loggers by name', () => {
    const logger1 = loglevel.getLogger('cached-service')
    const logger2 = loglevel.getLogger('cached-service')
    expect(logger1).toBe(logger2)
  })

  it('allows changing log levels without throwing', () => {
    const logger = loglevel.getLogger('level-test')
    expect(() => logger.setLevel('debug')).not.toThrow()
    expect(logger.getLevel()).toBe(levels.DEBUG)

    expect(() => logger.setLevel('silent')).not.toThrow()
    expect(logger.getLevel()).toBe(levels.SILENT)

    expect(() => logger.setLevel(levels.INFO)).not.toThrow()
    expect(logger.getLevel()).toBe(levels.INFO)
  })

  it('provides default export loopback', () => {
    expect(loglevel.default).toBe(loglevel)
  })
})
