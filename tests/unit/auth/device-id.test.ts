import { describe, expect, it } from 'vitest'
import {
  getDefaultDeviceLabel,
  getDevicePlatform,
  getOrCreateDeviceId,
} from '~/features/auth/services/device-id'

describe('device-id stability', () => {
  it('returns a stable non-empty device id across successive calls', async () => {
    const id1 = await getOrCreateDeviceId()
    const id2 = await getOrCreateDeviceId()
    const id3 = await getOrCreateDeviceId()

    expect(typeof id1).toBe('string')
    expect(id1.length).toBeGreaterThan(0)
    expect(id1).toBe(id2)
    expect(id2).toBe(id3)
  })

  it('returns valid platform and device label', () => {
    const platform = getDevicePlatform()
    expect(['web', 'ios', 'android']).toContain(platform)

    const label = getDefaultDeviceLabel()
    expect(typeof label).toBe('string')
    expect(label.length).toBeGreaterThan(0)
  })
})
