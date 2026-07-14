import { describe, expect, it } from 'vitest'

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
    // URL unset in test env → null (safe for SSR / browser without config)
    await expect(fetchRemoteUpdateConfig()).resolves.toBeNull()
  })
})
