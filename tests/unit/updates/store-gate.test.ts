import { describe, expect, it, vi } from 'vitest'

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(), setItem: vi.fn() },
}))

import { STORE_UPDATE_REMIND_AFTER_MS } from '~/lib/updates/constants'
import {
  availableStoreVersion,
  requiredStoreVersion,
  shouldPromptStoreUpdate,
} from '~/lib/updates/store-gate'

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

describe('availableStoreVersion', () => {
  it('offers a newer optional store version', () => {
    expect(
      availableStoreVersion({ minimumSupportedVersion: '6.1.2', latestVersion: '6.1.3' }, '6.1.2'),
    ).toBe('6.1.3')
  })

  it('stays quiet when current', () => {
    expect(
      availableStoreVersion({ minimumSupportedVersion: '6.1.2', latestVersion: '6.1.2' }, '6.1.2'),
    ).toBeNull()
    expect(
      availableStoreVersion({ minimumSupportedVersion: '6.1.2', latestVersion: '6.1.2' }, '6.1.4'),
    ).toBeNull()
  })

  it('defers to the mandatory gate below the minimum', () => {
    expect(
      availableStoreVersion({ minimumSupportedVersion: '6.1.2', latestVersion: '6.1.3' }, '6.0.11'),
    ).toBeNull()
  })
})

describe('shouldPromptStoreUpdate', () => {
  const now = 1_000_000_000_000

  it('prompts when never dismissed or a newer version ships', () => {
    expect(shouldPromptStoreUpdate('6.1.3', null, now)).toBe(true)
    expect(shouldPromptStoreUpdate('6.1.4', { version: '6.1.3', dismissedAt: now }, now)).toBe(true)
  })

  it('waits out the reminder window after "Later"', () => {
    const dismissal = { version: '6.1.3', dismissedAt: now }
    expect(shouldPromptStoreUpdate('6.1.3', dismissal, now + 1000)).toBe(false)
    expect(
      shouldPromptStoreUpdate('6.1.3', dismissal, now + STORE_UPDATE_REMIND_AFTER_MS),
    ).toBe(true)
  })
})
