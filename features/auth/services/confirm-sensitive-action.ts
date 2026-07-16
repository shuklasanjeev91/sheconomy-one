import { Platform } from 'react-native'

import {
  authenticateWithBiometrics,
  getBiometricCapability,
} from '~/features/auth/services/biometric-unlock'

/**
 * Gate sensitive account changes with Face ID / biometrics when enrolled.
 * Web and devices without biometrics always allow (caller keeps ConfirmDialog).
 */
export async function confirmSensitiveAction(promptMessage: string): Promise<{
  ok: boolean
  error: string | null
}> {
  if (Platform.OS === 'web') {
    return { ok: true, error: null }
  }

  const capability = await getBiometricCapability()
  if (!capability.supported || !capability.enrolled) {
    return { ok: true, error: null }
  }

  const result = await authenticateWithBiometrics(promptMessage)
  if (!result.success) {
    return { ok: false, error: result.error ?? `${capability.label} confirmation failed.` }
  }
  return { ok: true, error: null }
}
