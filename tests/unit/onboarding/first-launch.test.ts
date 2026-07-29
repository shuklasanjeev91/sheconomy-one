import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = new Map<string, string>()

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value)
    }),
    removeItem: vi.fn(async (key: string) => {
      store.delete(key)
    }),
  },
}))

import {
  APP_ONBOARDING_SEEN_KEY,
  hasSeenAppOnboarding,
  markAppOnboardingSeen,
  resetAppOnboardingSeen,
} from '~/lib/onboarding/first-launch'

describe('app onboarding first-launch flag', () => {
  beforeEach(() => {
    store.clear()
  })

  it('starts unseen and marks seen after finish', async () => {
    expect(await hasSeenAppOnboarding()).toBe(false)
    await markAppOnboardingSeen()
    expect(await hasSeenAppOnboarding()).toBe(true)
    expect(store.get(APP_ONBOARDING_SEEN_KEY)).toBe('1')
  })

  it('can reset for replay', async () => {
    await markAppOnboardingSeen()
    await resetAppOnboardingSeen()
    expect(await hasSeenAppOnboarding()).toBe(false)
  })
})
