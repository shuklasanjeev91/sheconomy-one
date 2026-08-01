import { describe, expect, it } from 'vitest'

import { installDOMExceptionPolyfill } from '~/lib/polyfills/dom-exception'

describe('installDOMExceptionPolyfill', () => {
  it('installs a usable DOMException on globalThis', () => {
    const g = globalThis as typeof globalThis & { DOMException?: typeof DOMException }
    const previous = g.DOMException
    // Force reinstall path by clearing (vitest may already have one in jsdom).
    // @ts-expect-error test-only
    delete g.DOMException
    installDOMExceptionPolyfill()

    expect(typeof g.DOMException).toBe('function')
    const err = new g.DOMException!('boom', 'AbortError')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('AbortError')
    expect(err.message).toBe('boom')
    expect(err.code).toBe(20)

    class Child extends g.DOMException! {}
    expect(new Child('x', 'TimeoutError').name).toBe('TimeoutError')

    if (previous) g.DOMException = previous
  })
})
