import { Platform } from 'react-native'

import { GENDER_VERIFICATION_PROMPT } from '~/lib/gender-verification/constants'
import { persistStorage } from '~/lib/store/storage'

const { verificationFlowStorageKey: FLOW_KEY } = GENDER_VERIFICATION_PROMPT

/** In-memory flag — native AsyncStorage is async; sync peek must still work. */
let memoryOpen = false

/** Sync peek — redirect must not run while the user opened verification. */
export function peekVerificationFlowOpen(): boolean {
  if (memoryOpen) return true
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      return window.localStorage.getItem(FLOW_KEY) === '1'
    } catch {
      return false
    }
  }
  return false
}

export async function markVerificationFlowOpen(): Promise<void> {
  memoryOpen = true
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem(FLOW_KEY, '1')
      return
    }
    await persistStorage.setItem(FLOW_KEY, '1')
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
    if (raw === '1') {
      memoryOpen = true
      return true
    }
    return false
  } catch {
    return false
  }
}
