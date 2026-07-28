import AsyncStorage from '@react-native-async-storage/async-storage'

/** Persisted after the user finishes or skips the intro carousel. */
export const APP_ONBOARDING_SEEN_KEY = 'sheconomy.auth.onboarding.seen'

export async function hasSeenAppOnboarding(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(APP_ONBOARDING_SEEN_KEY)
    return value === '1'
  } catch {
    return false
  }
}

export async function markAppOnboardingSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(APP_ONBOARDING_SEEN_KEY, '1')
  } catch {
    // Ignore storage failures — user can see intro again next launch.
  }
}

/** Test / settings reset helper. */
export async function resetAppOnboardingSeen(): Promise<void> {
  try {
    await AsyncStorage.removeItem(APP_ONBOARDING_SEEN_KEY)
  } catch {
    // ignore
  }
}
