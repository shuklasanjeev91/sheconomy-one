import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

const FLAG_KEY = 'sheconomy.auth.biometric_unlock_enabled'
const UNLOCKED_KEY = 'sheconomy.auth.biometric_session_unlocked'

export type BiometricCapability = {
  supported: boolean
  enrolled: boolean
  label: string
}

export async function getBiometricCapability(): Promise<BiometricCapability> {
  if (Platform.OS === 'web') {
    return { supported: false, enrolled: false, label: 'Biometrics' }
  }

  try {
    const LocalAuthentication = await import('expo-local-authentication')
    const compatible = await LocalAuthentication.hasHardwareAsync()
    const enrolled = compatible ? await LocalAuthentication.isEnrolledAsync() : false
    const types = compatible ? await LocalAuthentication.supportedAuthenticationTypesAsync() : []
    const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
    const hasFinger = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
    let label = 'Device PIN'
    if (hasFace && Platform.OS === 'ios') label = 'Face ID'
    else if (hasFace) label = 'Face unlock'
    else if (hasFinger && Platform.OS === 'ios') label = 'Touch ID'
    else if (hasFinger) label = 'Fingerprint'
    return { supported: compatible, enrolled, label }
  } catch {
    return { supported: false, enrolled: false, label: 'Biometrics' }
  }
}

export async function isBiometricUnlockEnabled(): Promise<boolean> {
  try {
    if (Platform.OS !== 'web') {
      try {
        const SecureStore = await import('expo-secure-store')
        const value = await SecureStore.getItemAsync(FLAG_KEY)
        if (value != null) return value === '1'
      } catch {
        // fall through
      }
    }
    const value = await AsyncStorage.getItem(FLAG_KEY)
    return value === '1'
  } catch {
    return false
  }
}

export async function setBiometricUnlockEnabled(enabled: boolean): Promise<void> {
  const value = enabled ? '1' : '0'
  try {
    if (Platform.OS !== 'web') {
      try {
        const SecureStore = await import('expo-secure-store')
        await SecureStore.setItemAsync(FLAG_KEY, value)
        return
      } catch {
        // fall through
      }
    }
    await AsyncStorage.setItem(FLAG_KEY, value)
  } catch {
    // ignore
  }
}

/** Soft in-memory/session flag so we don't re-prompt on every navigation. */
export async function markBiometricUnlocked(unlocked: boolean): Promise<void> {
  try {
    if (unlocked) await AsyncStorage.setItem(UNLOCKED_KEY, '1')
    else await AsyncStorage.removeItem(UNLOCKED_KEY)
  } catch {
    // ignore
  }
}

export async function isBiometricUnlockedThisSession(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(UNLOCKED_KEY)) === '1'
  } catch {
    return false
  }
}

export async function authenticateWithBiometrics(promptMessage?: string): Promise<{
  success: boolean
  error: string | null
}> {
  if (Platform.OS === 'web') {
    return { success: true, error: null }
  }

  try {
    const LocalAuthentication = await import('expo-local-authentication')
    const capability = await getBiometricCapability()
    if (!capability.supported || !capability.enrolled) {
      return { success: false, error: `${capability.label} is not available on this device.` }
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: promptMessage ?? `Unlock SHEconomy with ${capability.label}`,
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
      fallbackLabel: 'Use device passcode',
    })

    if (result.success) {
      await markBiometricUnlocked(true)
      return { success: true, error: null }
    }
    return { success: false, error: 'Authentication cancelled or failed.' }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Biometric unlock failed.',
    }
  }
}

/** True when we should show the lock gate (native + enabled + session present + not unlocked). */
export async function shouldRequireBiometricUnlock(hasSession: boolean): Promise<boolean> {
  if (!hasSession || Platform.OS === 'web') return false
  const enabled = await isBiometricUnlockEnabled()
  if (!enabled) return false
  const unlocked = await isBiometricUnlockedThisSession()
  return !unlocked
}
