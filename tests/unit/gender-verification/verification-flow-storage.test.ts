import { beforeEach, describe, expect, it, vi } from 'vitest'

const stored = new Map<string, string>()

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }))
vi.mock('~/lib/store/storage', () => ({
  persistStorage: {
    getItem: async (key: string) => stored.get(key) ?? null,
    setItem: async (key: string, value: string) => void stored.set(key, value),
    removeItem: async (key: string) => void stored.delete(key),
  },
}))

import { GENDER_VERIFICATION_PROMPT } from '~/lib/gender-verification/constants'
import {
  clearVerificationFlowOpen,
  markVerificationFlowOpen,
  readVerificationFlowOpen,
} from '~/lib/gender-verification/verification-flow-storage'

const KEY = GENDER_VERIFICATION_PROMPT.verificationFlowStorageKey

describe('verification flow-open flag', () => {
  beforeEach(async () => {
    stored.clear()
    await clearVerificationFlowOpen()
  })

  it('persists a timestamp and reopens a flow started moments ago (after restart)', async () => {
    await markVerificationFlowOpen()
    const saved = stored.get(KEY)
    expect(Number(saved)).toBeGreaterThan(1e12)

    await clearVerificationFlowOpen()
    stored.set(KEY, saved!)
    expect(await readVerificationFlowOpen()).toBe(true)
  })

  it('treats an old flag as abandoned and removes it', async () => {
    stored.set(KEY, String(Date.now() - GENDER_VERIFICATION_PROMPT.verificationFlowTtlMs - 1000))
    expect(await readVerificationFlowOpen()).toBe(false)
    expect(stored.has(KEY)).toBe(false)
  })

  it('ignores the legacy "1" flag so it cannot pop the modal over unrelated screens', async () => {
    stored.set(KEY, '1')
    expect(await readVerificationFlowOpen()).toBe(false)
    expect(stored.has(KEY)).toBe(false)
  })
})
