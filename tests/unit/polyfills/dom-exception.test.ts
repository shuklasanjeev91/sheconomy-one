import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { installDOMExceptionPolyfill } from '~/lib/polyfills/dom-exception'

const ROOT = resolve(__dirname, '../../..')

/** Import specifiers in source order, so we can assert what Hermes evaluates first. */
function importOrder(file: string): string[] {
  const source = readFileSync(resolve(ROOT, file), 'utf8')
  return [...source.matchAll(/^import\s[^\n]*?['"]([^'"]+)['"]/gm)].map((match) => match[1]!)
}

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

describe('DOMException install order', () => {
  const POLYFILL = '~/lib/polyfills/install-dom-exception'

  it('installs before anything else in the native setup bundle', () => {
    expect(importOrder('lib/polyfills-side-effects.native.ts')[0]).toBe(POLYFILL)
  })

  // ES imports hoist above statements, so a guard call placed between imports runs
  // too late — these modules must import the polyfill before they import LiveKit.
  it.each([
    'co-work/screens/MeetingRoomScreen.tsx',
    'co-work/components/NativeLiveKitMeetingRoom.tsx',
    'co-work/hooks/useLiveKitMediaControls.native.tsx',
  ])('installs before LiveKit loads in %s', (file) => {
    const imports = importOrder(file)
    const liveKit = imports.findIndex((specifier) => /^(livekit-client|@livekit\/)/.test(specifier))

    expect(liveKit, 'expected a LiveKit import to guard').toBeGreaterThanOrEqual(0)
    expect(imports.indexOf(POLYFILL)).toBeGreaterThanOrEqual(0)
    expect(imports.indexOf(POLYFILL)).toBeLessThan(liveKit)
  })
})
