import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
})

/**
 * Web must not call expo-updates. The web manager only fetches remote config.
 * This smoke test documents the contract for the shared pure helpers.
 */
describe('web platform fallback', () => {
  it('does not require expo-updates for remote config helpers', async () => {
    const { fetchRemoteUpdateConfig, getUpdateConfigUrl } = await import(
      '~/lib/updates/remote-config'
    )
    expect(typeof fetchRemoteUpdateConfig).toBe('function')
    expect(typeof getUpdateConfigUrl).toBe('function')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      }),
    )
    // Unreachable config → null (safe for SSR / browser without config)
    await expect(fetchRemoteUpdateConfig()).resolves.toBeNull()
  })
})
