import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchRemoteUpdateConfig } from '~/lib/updates/remote-config'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('fetchRemoteUpdateConfig', () => {
  it('returns null when URL is not configured', async () => {
    vi.stubEnv('EXPO_PUBLIC_UPDATE_CONFIG_URL', '')
    await expect(fetchRemoteUpdateConfig()).resolves.toBeNull()
  })

  it('parses a valid remote payload', async () => {
    vi.stubEnv('EXPO_PUBLIC_UPDATE_CONFIG_URL', 'https://example.com/update-config.json')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          minimumSupportedVersion: '5.0.14',
          latestVersion: '6.0',
          critical: false,
          maintenanceMode: false,
        }),
      })),
    )

    await expect(fetchRemoteUpdateConfig()).resolves.toMatchObject({
      "minimumSupportedVersion": "5.0.14",
      "latestVersion": "6.0",
      critical: false,
      maintenanceMode: false,
    })
  })

  it('returns null on network failure', async () => {
    vi.stubEnv('EXPO_PUBLIC_UPDATE_CONFIG_URL', 'https://example.com/update-config.json')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      }),
    )
    await expect(fetchRemoteUpdateConfig()).resolves.toBeNull()
  })
})
