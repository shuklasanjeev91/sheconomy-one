import { beforeEach, describe, expect, it, vi } from 'vitest'

const storage = vi.hoisted(() => ({
  readPersistentValue: vi.fn<(key: string) => Promise<string | null>>(),
  writePersistentValue: vi.fn<(key: string, value: string) => Promise<void>>(),
}))

vi.mock('~/lib/platform/storage', () => storage)

import {
  MAX_BLUR_RADIUS,
  MIN_BLUR_RADIUS,
  loadVirtualBackgroundPreference,
  normalizeVirtualBackground,
  saveVirtualBackgroundPreference,
  virtualBackgroundUnavailableMessage,
  webBackgroundResourceWarning,
} from '~/co-work/lib/virtual-backgrounds'

describe('virtual background preferences', () => {
  beforeEach(() => vi.clearAllMocks())

  it('falls back to off for malformed or incomplete preferences', () => {
    expect(normalizeVirtualBackground(null)).toEqual({ mode: 'off' })
    expect(normalizeVirtualBackground({ mode: 'image' })).toEqual({ mode: 'off' })
  })

  it('clamps blur strength to the supported range', () => {
    expect(normalizeVirtualBackground({ mode: 'blur', blurRadius: 1 }).blurRadius).toBe(
      MIN_BLUR_RADIUS,
    )
    expect(normalizeVirtualBackground({ mode: 'blur', blurRadius: 99 }).blurRadius).toBe(
      MAX_BLUR_RADIUS,
    )
  })

  it('loads a valid remembered custom background', async () => {
    storage.readPersistentValue.mockResolvedValue(
      JSON.stringify({ mode: 'image', id: 'custom-1', storagePath: 'user/custom-1.jpg' }),
    )
    await expect(loadVirtualBackgroundPreference()).resolves.toEqual({
      mode: 'image',
      id: 'custom-1',
      storagePath: 'user/custom-1.jpg',
      imageUrl: undefined,
    })
  })

  it('does not persist expiring signed URLs for custom backgrounds', async () => {
    storage.writePersistentValue.mockResolvedValue()
    await saveVirtualBackgroundPreference({
      mode: 'image',
      id: 'custom-1',
      storagePath: 'user/custom-1.jpg',
      imageUrl: 'https://example.test/temporary',
    })
    const stored = JSON.parse(storage.writePersistentValue.mock.calls[0][1])
    expect(stored.storagePath).toBe('user/custom-1.jpg')
    expect(stored.imageUrl).toBeUndefined()
  })

  it('rejects web effects on resource-constrained devices', () => {
    expect(webBackgroundResourceWarning({ deviceMemory: 2, hardwareConcurrency: 8 })).toContain(
      'low-memory',
    )
    expect(webBackgroundResourceWarning({ deviceMemory: 8, hardwareConcurrency: 2 })).toContain(
      'processing capacity',
    )
    expect(webBackgroundResourceWarning({ deviceMemory: 8, hardwareConcurrency: 8 })).toBeNull()
  })

  it('keeps unsupported-device messaging non-blocking', () => {
    expect(virtualBackgroundUnavailableMessage('web')).toContain('camera stays unfiltered')
    expect(virtualBackgroundUnavailableMessage('native')).toContain('camera stays unfiltered')
  })
})
