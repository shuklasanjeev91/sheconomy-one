import { describe, expect, it, vi } from 'vitest'

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(), setItem: vi.fn() },
}))

import { requiredStoreVersion } from '~/lib/updates/store-gate'

describe('requiredStoreVersion', () => {
  it('blocks installs below the minimum', () => {
    expect(requiredStoreVersion({ minimumSupportedVersion: '6.1.2' }, '6.1.1')).toBe('6.1.2')
    expect(requiredStoreVersion({ minimumSupportedVersion: '6.1.0' }, '6.0.11')).toBe('6.1.0')
  })

  it('allows installs at or above the minimum', () => {
    expect(requiredStoreVersion({ minimumSupportedVersion: '6.1.2' }, '6.1.2')).toBeNull()
    expect(requiredStoreVersion({ minimumSupportedVersion: '6.1.2' }, '6.10.0')).toBeNull()
  })

  it('never blocks without a policy', () => {
    expect(requiredStoreVersion(null, '1.0.0')).toBeNull()
    expect(requiredStoreVersion({ minimumSupportedVersion: '' }, '1.0.0')).toBeNull()
  })
})
