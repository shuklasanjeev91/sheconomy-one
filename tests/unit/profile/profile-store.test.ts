import { beforeEach, describe, expect, it, vi } from 'vitest'

const maybeSingle = vi.fn()

vi.mock('~/lib/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => maybeSingle() }),
      }),
    }),
  },
}))

import { getAccessTier } from '~/lib/auth/access'
import { clearCachedProfile } from '~/lib/profile/profile-cache'
import {
  ensureSessionProfile,
  getSessionProfileSnapshot,
  patchSessionProfile,
  refreshSessionProfile,
  resetSessionProfileStore,
  subscribeSessionProfile,
} from '~/lib/profile/profile-store'

const USER = 'user-1'

function row(over: Record<string, unknown> = {}) {
  return { id: USER, role: 'U', gender: false, is_verified: false, avatar_url: null, ...over }
}

function serveRow(over: Record<string, unknown> = {}) {
  maybeSingle.mockResolvedValue({ data: row(over), error: null })
}

/** Let the store's queued microtasks / async cache reads settle. */
async function settle() {
  for (let i = 0; i < 5; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

function tierNow() {
  const { profile } = getSessionProfileSnapshot()
  return getAccessTier(true, profile?.gender, profile?.is_verified)
}

describe('session profile store', () => {
  beforeEach(async () => {
    maybeSingle.mockReset()
    await clearCachedProfile()
    resetSessionProfileStore()
  })

  it('serves every consumer from a single request', async () => {
    serveRow()

    // Stand in for the ~40 components that each call useProfile().
    for (let i = 0; i < 40; i += 1) ensureSessionProfile(USER)
    await settle()

    expect(maybeSingle).toHaveBeenCalledTimes(1)
    expect(getSessionProfileSnapshot().profile?.id).toBe(USER)
    expect(getSessionProfileSnapshot().isSettled).toBe(true)
  })

  it('hands every subscriber the same snapshot', async () => {
    serveRow({ gender: true, is_verified: true })

    const seen: unknown[] = []
    const unsubA = subscribeSessionProfile(() => seen.push(getSessionProfileSnapshot()))
    const unsubB = subscribeSessionProfile(() => seen.push(getSessionProfileSnapshot()))

    ensureSessionProfile(USER)
    await settle()

    expect(seen.length).toBeGreaterThan(0)
    // Both listeners read the one shared object — no split state to disagree over.
    expect(new Set(seen).size).toBeLessThan(seen.length)
    expect(seen.at(-1)).toBe(getSessionProfileSnapshot())
    expect(tierNow()).toBe('female')

    unsubA()
    unsubB()
  })

  it('applies a verification patch immediately and keeps it through a stale read', async () => {
    serveRow()
    ensureSessionProfile(USER)
    await settle()
    expect(tierNow()).toBe('male')

    // The server has committed; the tab bar must not see the old row for a moment.
    patchSessionProfile(USER, { gender: true, is_verified: true })
    expect(tierNow()).toBe('female')

    // The confirming refetch still returns the pre-verification row.
    await settle()
    expect(tierNow()).toBe('female')

    serveRow({ gender: true, is_verified: true })
    refreshSessionProfile()
    await settle()
    expect(tierNow()).toBe('female')
  })

  it('coalesces refreshes fired while a request is in flight', async () => {
    serveRow()
    ensureSessionProfile(USER)
    await settle()
    expect(maybeSingle).toHaveBeenCalledTimes(1)

    let release = (): void => {}
    maybeSingle.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ data: row(), error: null })
        }),
    )

    refreshSessionProfile()
    refreshSessionProfile()
    refreshSessionProfile()
    expect(maybeSingle).toHaveBeenCalledTimes(2)

    serveRow()
    release()
    await settle()

    // One in-flight request plus at most one queued follow-up.
    expect(maybeSingle).toHaveBeenCalledTimes(3)
  })

  it('clears everything on sign-out', async () => {
    serveRow({ gender: true, is_verified: true })
    ensureSessionProfile(USER)
    await settle()
    expect(getSessionProfileSnapshot().profile).not.toBeNull()

    ensureSessionProfile(null)
    expect(getSessionProfileSnapshot().profile).toBeNull()
    expect(getSessionProfileSnapshot().userId).toBeNull()
  })

  it('surfaces a query error without stranding consumers in loading', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: 'boom' } })
    ensureSessionProfile(USER)
    await settle()

    expect(getSessionProfileSnapshot().error).toBe('boom')
    expect(getSessionProfileSnapshot().isSettled).toBe(true)
  })

  it('retries a failed read and reports the row once it lands', async () => {
    vi.useFakeTimers()
    try {
      maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'network down' } })
      ensureSessionProfile(USER)
      await vi.advanceTimersByTimeAsync(0)

      // Nothing is known yet, so gates must not judge the member as unverified.
      expect(getSessionProfileSnapshot().profile).toBeNull()
      expect(getSessionProfileSnapshot().isServerSettled).toBe(false)

      maybeSingle.mockResolvedValue({ data: row({ gender: true, is_verified: true }), error: null })
      await vi.advanceTimersByTimeAsync(2_000)

      expect(getSessionProfileSnapshot().profile?.is_verified).toBe(true)
      expect(getSessionProfileSnapshot().isServerSettled).toBe(true)
      expect(getSessionProfileSnapshot().error).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not call a slow read authoritative when the fetch times out', async () => {
    vi.useFakeTimers()
    try {
      let resolveRead: (value: unknown) => void = () => {}
      maybeSingle.mockReturnValue(
        new Promise((resolve) => {
          resolveRead = resolve
        }),
      )

      ensureSessionProfile(USER)
      // Past the settle timeout, with the request still in flight.
      await vi.advanceTimersByTimeAsync(3_000)

      expect(getSessionProfileSnapshot().isSettled).toBe(true)
      expect(getSessionProfileSnapshot().profile).toBeNull()
      // The empty profile is unknown, not "unverified" — this is what kept
      // redirecting verified members to ?gender=restricted.
      expect(getSessionProfileSnapshot().isServerSettled).toBe(false)

      resolveRead({ data: row({ gender: true, is_verified: true }), error: null })
      await vi.advanceTimersByTimeAsync(0)

      expect(getSessionProfileSnapshot().isServerSettled).toBe(true)
      expect(getSessionProfileSnapshot().profile?.is_verified).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('never calls an exhausted retry an answer from the server', async () => {
    vi.useFakeTimers()
    try {
      maybeSingle.mockResolvedValue({ data: null, error: { message: 'network down' } })

      ensureSessionProfile(USER)
      // Long enough for every attempt in the burst to fail.
      await vi.advanceTimersByTimeAsync(10_000)

      // Giving up tells us nothing about the member. Reporting this as a server
      // answer read as "unverified" and bounced her to ?gender=restricted.
      expect(getSessionProfileSnapshot().isServerSettled).toBe(false)
      expect(getSessionProfileSnapshot().hasFailed).toBe(true)
      expect(getSessionProfileSnapshot().isFetching).toBe(false)

      // The background recovery pass picks the row up once the network returns.
      maybeSingle.mockResolvedValue({ data: row({ gender: true, is_verified: true }), error: null })
      await vi.advanceTimersByTimeAsync(21_000)

      expect(getSessionProfileSnapshot().hasFailed).toBe(false)
      expect(getSessionProfileSnapshot().isServerSettled).toBe(true)
      expect(tierNow()).toBe('female')
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not mark a warm cached row as server-confirmed', async () => {
    // Seed the cache with a row captured before the member verified.
    serveRow({ gender: false, is_verified: false })
    ensureSessionProfile(USER)
    await settle()
    expect(getSessionProfileSnapshot().isServerSettled).toBe(true)

    resetSessionProfileStore()

    // Reload with the (now stale) cache warm and the network still in flight.
    let resolveRead: (value: unknown) => void = () => {}
    maybeSingle.mockReturnValue(
      new Promise((resolve) => {
        resolveRead = resolve
      }),
    )

    ensureSessionProfile(USER)
    await settle()

    // The cached row may paint, but it must not be treated as a confirmed
    // answer — denying on it is what bounced verified members to
    // ?gender=restricted on every reload.
    expect(getSessionProfileSnapshot().isServerSettled).toBe(false)

    resolveRead({ data: row({ gender: true, is_verified: true }), error: null })
    await settle()

    expect(getSessionProfileSnapshot().isServerSettled).toBe(true)
    expect(tierNow()).toBe('female')
  })
})
