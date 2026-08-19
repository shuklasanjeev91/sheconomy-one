/**
 * The single shared copy of the signed-in member's profile row.
 *
 * Every consumer (`useProfile`) reads this one store, so access decisions can
 * never disagree between components. Before this existed each caller ran its own
 * query and kept its own copy, which let the nav bar act on a pre-verification
 * row while the verification host acted on the fresh one — a tap on a
 * women-first tab was then silently discarded.
 *
 * Fetches are deduped: one request per user id, with at most one queued refetch.
 */

import {
  clearCachedProfile,
  peekCachedProfile,
  readCachedProfile,
  writeCachedProfile,
} from '~/lib/profile/profile-cache'
import type { SessionProfile } from '~/lib/profile/session-profile'
import { SESSION_PROFILE_COLUMNS } from '~/lib/profile/session-profile'
import { supabase } from '~/lib/supabase/client'

/** Matches the old per-component timeout so a slow network still settles the UI. */
const PROFILE_FETCH_TIMEOUT_MS = 2_500
const PROFILE_FETCH_MAX_ATTEMPTS = 3
const PROFILE_RETRY_DELAY_MS = 1_200
/** How long to wait before trying again once the burst of attempts is spent. */
const PROFILE_RECOVERY_DELAY_MS = 20_000

export type SessionProfileSnapshot = {
  /** The user this snapshot describes (`null` when signed out). */
  userId: string | null
  profile: SessionProfile | null
  /**
   * A usable answer exists for `userId` — from cache, the network, or a timeout.
   * Gates must wait for this instead of treating "unknown" as "unverified".
   */
  isSettled: boolean
  /**
   * The server answered for `userId`, so a missing row means the row really is
   * absent rather than still in flight. A timeout does not set this: access
   * gates must not downgrade a member whose row simply has not arrived yet.
   */
  isServerSettled: boolean
  isFetching: boolean
  /**
   * Every attempt to read the row failed. The member's access is *unknown*, not
   * limited — gates must offer a retry rather than downgrade them.
   */
  hasFailed: boolean
  error: string | null
}

const EMPTY_SNAPSHOT: SessionProfileSnapshot = {
  userId: null,
  profile: null,
  isSettled: false,
  isServerSettled: false,
  isFetching: false,
  hasFailed: false,
  error: null,
}

let snapshot: SessionProfileSnapshot = EMPTY_SNAPSHOT
const listeners = new Set<() => void>()

/** Bumped on every user switch / refetch so late async work can be discarded. */
let generation = 0
let networkSettledFor = 0
let queuedRefetch = false
let recoveryTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Locally applied fields the server has not confirmed yet. Re-applied on top of
 * every fetched row so a stale read cannot revoke access the user just earned.
 */
let pendingPatch: { userId: string; patch: Partial<SessionProfile> } | null = null

function emit(): void {
  for (const listener of listeners) {
    try {
      listener()
    } catch {
      // A broken subscriber must not stop the rest from updating.
    }
  }
}

function setSnapshot(patch: Partial<SessionProfileSnapshot>): void {
  const next: SessionProfileSnapshot = { ...snapshot, ...patch }
  if (
    next.userId === snapshot.userId &&
    next.profile === snapshot.profile &&
    next.isSettled === snapshot.isSettled &&
    next.isServerSettled === snapshot.isServerSettled &&
    next.isFetching === snapshot.isFetching &&
    next.hasFailed === snapshot.hasFailed &&
    next.error === snapshot.error
  ) {
    return
  }
  snapshot = next
  emit()
}

export function subscribeSessionProfile(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Stable reference — only replaced when something actually changed. */
export function getSessionProfileSnapshot(): SessionProfileSnapshot {
  return snapshot
}

/**
 * Keep a fresh public URL that was just uploaded when the row we just read still
 * has no avatar (the write may not be visible yet).
 */
function uploadedStorageAvatar(profile: SessionProfile | null, userId: string): string | null {
  if (!profile || profile.id !== userId) return null
  const raw = profile.avatar_url?.trim()
  if (!raw) return null
  return raw.includes('/storage/v1/object/public/') ? raw : null
}

/** Overlay unconfirmed local fields on a row, without deciding anything about them. */
function mergePendingPatch(userId: string, row: SessionProfile | null): SessionProfile | null {
  if (!row || pendingPatch?.userId !== userId) return row
  return { ...row, ...pendingPatch.patch }
}

/**
 * Overlay unconfirmed fields on a row the *server* returned, and drop the ones
 * it now reports. Only the server can confirm a patch — the local cache holds
 * our own optimistic write, so reading it back proves nothing.
 */
function confirmPendingPatch(userId: string, row: SessionProfile | null): SessionProfile | null {
  if (!row || pendingPatch?.userId !== userId) return row

  const patch = pendingPatch.patch
  const keys = Object.keys(patch) as (keyof SessionProfile)[]
  // Only scalars can be compared for confirmation; arrays / JSON columns are
  // treated as confirmed on the first read so they never stick forever.
  const unconfirmed = keys.filter(
    (key) => row[key] !== patch[key] && typeof patch[key] !== 'object',
  )

  if (unconfirmed.length === 0) {
    pendingPatch = null
    return row
  }

  pendingPatch = {
    userId,
    patch: Object.fromEntries(
      unconfirmed.map((key) => [key, patch[key]]),
    ) as Partial<SessionProfile>,
  }
  return { ...row, ...pendingPatch.patch }
}

/** Keep trying in the background so a passing outage heals without a tap. */
function scheduleRecovery(userId: string, gen: number): void {
  if (recoveryTimer) clearTimeout(recoveryTimer)
  recoveryTimer = setTimeout(() => {
    recoveryTimer = null
    if (generation !== gen || snapshot.userId !== userId || !snapshot.hasFailed) return
    load(userId)
  }, PROFILE_RECOVERY_DELAY_MS)
}

/**
 * Give up on a failed read only after a few tries.
 *
 * A failed read must never set `isServerSettled`: the server did not answer, so
 * the member's tier is unknown. Claiming otherwise turned any transient
 * network or token error into "unverified" and bounced full-access members to
 * `?gender=restricted`. `hasFailed` lets gates show a retry instead.
 */
function retryOrGiveUp(userId: string, gen: number, attempt: number, error: string): void {
  if (attempt + 1 >= PROFILE_FETCH_MAX_ATTEMPTS) {
    setSnapshot({ isSettled: true, isFetching: false, hasFailed: true, error })
    scheduleRecovery(userId, gen)
    return
  }

  setSnapshot({ isSettled: true, isFetching: true, error })
  setTimeout(() => {
    if (generation !== gen) return
    void fetchProfile(userId, gen, attempt + 1)
  }, PROFILE_RETRY_DELAY_MS * (attempt + 1))
}

async function fetchProfile(userId: string, gen: number, attempt = 0): Promise<void> {
  const timeout = setTimeout(() => {
    if (generation !== gen) return
    setSnapshot({
      isFetching: false,
      isSettled: true,
      error: snapshot.profile ? snapshot.error : (snapshot.error ?? 'Profile load timed out'),
    })
  }, PROFILE_FETCH_TIMEOUT_MS)

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(SESSION_PROFILE_COLUMNS)
      .eq('id', userId)
      .maybeSingle()

    if (generation !== gen) return
    networkSettledFor = gen

    if (error) {
      retryOrGiveUp(userId, gen, attempt, error.message)
      return
    }

    const row = (data ?? null) as SessionProfile | null
    const keepAvatar = row?.avatar_url?.trim()
      ? null
      : uploadedStorageAvatar(peekCachedProfile(userId), userId)
    const profile = confirmPendingPatch(
      userId,
      row && keepAvatar ? { ...row, avatar_url: keepAvatar } : row,
    )

    setSnapshot({
      profile,
      isSettled: true,
      isServerSettled: true,
      isFetching: false,
      hasFailed: false,
      error: null,
    })
    if (profile) void writeCachedProfile(userId, profile)
  } catch (err) {
    if (generation !== gen) return
    networkSettledFor = gen
    retryOrGiveUp(
      userId,
      gen,
      attempt,
      err instanceof Error ? err.message : 'Could not load profile',
    )
  } finally {
    clearTimeout(timeout)
    if (generation === gen && queuedRefetch) {
      queuedRefetch = false
      load(userId)
    }
  }
}

function load(userId: string): void {
  const gen = ++generation
  const switching = snapshot.userId !== userId

  if (recoveryTimer) {
    clearTimeout(recoveryTimer)
    recoveryTimer = null
  }

  setSnapshot({
    userId,
    profile: switching ? null : snapshot.profile,
    isSettled: switching ? false : snapshot.isSettled,
    isServerSettled: switching ? false : snapshot.isServerSettled,
    isFetching: true,
    hasFailed: false,
    error: null,
  })

  // Warm start — web reads the cache synchronously. Only paint the cache when we
  // have nothing better: on a same-user refresh the snapshot already holds a
  // server-confirmed row, and overwriting it with an older cached one would
  // leave `isServerSettled` true while describing an unconfirmed profile —
  // exactly the state gates are allowed to deny on.
  const warm = snapshot.profile ? null : peekCachedProfile(userId)
  if (warm) {
    setSnapshot({ profile: mergePendingPatch(userId, warm), isSettled: true })
  } else if (!snapshot.profile) {
    // Native has no synchronous cache, so hydrate alongside the request. Without
    // this a warm launch starts with an unknown profile and reads as unverified.
    void readCachedProfile(userId).then((cached) => {
      // Never clobber a network result that already landed.
      if (generation !== gen || !cached || networkSettledFor === gen) return
      setSnapshot({ profile: mergePendingPatch(userId, cached), isSettled: true })
    })
  }

  void fetchProfile(userId, gen)
}

/**
 * Load the profile for `userId` if it is not already loaded / loading.
 * Pass `null` when signed out to clear the store.
 */
export function ensureSessionProfile(userId: string | null): void {
  if (!userId) {
    if (snapshot === EMPTY_SNAPSHOT) return
    generation += 1
    queuedRefetch = false
    pendingPatch = null
    if (recoveryTimer) {
      clearTimeout(recoveryTimer)
      recoveryTimer = null
    }
    snapshot = EMPTY_SNAPSHOT
    void clearCachedProfile()
    emit()
    return
  }

  if (snapshot.userId === userId && (snapshot.isSettled || snapshot.isFetching)) return
  load(userId)
}

/** Retry after every attempt failed (the retry button on the access gate). */
export function retryFailedProfileFetch(): void {
  const userId = snapshot.userId
  if (!userId || !snapshot.hasFailed) return
  load(userId)
}

/** Refetch the current user's row (coalesced while a request is in flight). */
export function refreshSessionProfile(): void {
  const userId = snapshot.userId
  if (!userId) return
  if (snapshot.isFetching) {
    queuedRefetch = true
    return
  }
  load(userId)
}

/**
 * Apply known-good fields immediately (e.g. verification passed, avatar
 * uploaded) so every consumer sees them before the round-trip, then confirm
 * against the server. The fields stick until the server reports them.
 */
export function patchSessionProfile(userId: string, patch: Partial<SessionProfile>): void {
  if (!userId) return

  pendingPatch = {
    userId,
    patch: pendingPatch?.userId === userId ? { ...pendingPatch.patch, ...patch } : { ...patch },
  }

  if (snapshot.userId === userId && snapshot.profile?.id === userId) {
    setSnapshot({ profile: { ...snapshot.profile, ...patch }, isSettled: true })
  }

  void persistPatch(userId, patch)
  refreshSessionProfile()
}

async function persistPatch(userId: string, patch: Partial<SessionProfile>): Promise<void> {
  const current =
    (snapshot.userId === userId ? snapshot.profile : null) ?? (await readCachedProfile(userId))
  if (!current || current.id !== userId) return
  await writeCachedProfile(userId, { ...current, ...patch })
}

/** Test seam — drop all state without touching the persisted cache. */
export function resetSessionProfileStore(): void {
  generation += 1
  networkSettledFor = 0
  queuedRefetch = false
  pendingPatch = null
  if (recoveryTimer) {
    clearTimeout(recoveryTimer)
    recoveryTimer = null
  }
  snapshot = EMPTY_SNAPSHOT
  emit()
}
