import { Platform } from 'react-native'

import { GENDER_VERIFICATION_PROMPT } from '~/lib/gender-verification/constants'
import { persistStorage } from '~/lib/store/storage'

const { verificationFlowStorageKey: FLOW_KEY, verificationFlowTtlMs: FLOW_TTL_MS } =
  GENDER_VERIFICATION_PROMPT

/** In-memory flag — native AsyncStorage is async; sync peek must still work. */
let memoryOpen = false

/**
 * The flag only has to bridge a camera-permission prompt or reload. Anything
 * older (including the legacy `'1'` value) is a flow the member abandoned and
 * must not reopen the modal on some unrelated screen.
 */
function isFreshFlag(raw: string | null | undefined): boolean {
  const openedAt = Number(raw)
  if (!raw || !Number.isFinite(openedAt) || openedAt < 1e12) return false
  return Date.now() - openedAt < FLOW_TTL_MS
}

/** Sync peek — redirect must not run while the user opened verification. */
export function peekVerificationFlowOpen(): boolean {
  if (memoryOpen) return true
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      return isFreshFlag(window.localStorage.getItem(FLOW_KEY))
    } catch {
      return false
    }
  }
  return false
}

export async function markVerificationFlowOpen(): Promise<void> {
  memoryOpen = true
  const value = String(Date.now())
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem(FLOW_KEY, value)
      return
    }
    await persistStorage.setItem(FLOW_KEY, value)
  } catch {
    // ignore quota errors
  }
}

export async function clearVerificationFlowOpen(): Promise<void> {
  memoryOpen = false
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.removeItem(FLOW_KEY)
      return
    }
    await persistStorage.removeItem(FLOW_KEY)
  } catch {
    // ignore
  }
}

export async function readVerificationFlowOpen(): Promise<boolean> {
  if (peekVerificationFlowOpen()) return true
  try {
    const raw = await persistStorage.getItem(FLOW_KEY)
    if (isFreshFlag(raw)) {
      memoryOpen = true
      return true
    }
    if (raw) await persistStorage.removeItem(FLOW_KEY)
    return false
  } catch {
    return false
  }
}
