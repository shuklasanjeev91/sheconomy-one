import { Platform } from 'react-native'

import { isSafeReturnPath } from '~/lib/auth/redirect'
import { GENDER_VERIFICATION_PROMPT } from '~/lib/gender-verification/constants'
import { persistStorage } from '~/lib/store/storage'

const { returnToStorageKey: RETURN_KEY } = GENDER_VERIFICATION_PROMPT

export async function rememberVerificationReturnTo(path: string | null | undefined): Promise<void> {
  if (!path || !isSafeReturnPath(path)) {
    await clearVerificationReturnTo()
    return
  }
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.sessionStorage.setItem(RETURN_KEY, path)
      return
    }
    await persistStorage.setItem(RETURN_KEY, path)
  } catch {
    // ignore quota errors
  }
}

export async function readVerificationReturnTo(): Promise<string | null> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const fromSession = window.sessionStorage.getItem(RETURN_KEY)
      if (fromSession && isSafeReturnPath(fromSession)) return fromSession
    }
    const raw = await persistStorage.getItem(RETURN_KEY)
    return raw && isSafeReturnPath(raw) ? raw : null
  } catch {
    return null
  }
}

export async function clearVerificationReturnTo(): Promise<void> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.sessionStorage.removeItem(RETURN_KEY)
    }
    await persistStorage.removeItem(RETURN_KEY)
  } catch {
    // ignore
  }
}
