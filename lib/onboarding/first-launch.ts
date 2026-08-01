import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * Persisted after the user finishes or skips the intro carousel.
 * Bump the suffix when the intro must be shown again after an update
 * (e.g. launch UX fix) so existing installs still get the carousel once.
 */
export const APP_ONBOARDING_SEEN_KEY = 'sheconomy.auth.onboarding.seen.v2'

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
    // Clear legacy key from earlier builds too.
    await AsyncStorage.removeItem('sheconomy.auth.onboarding.seen')
  } catch {
    // ignore
  }
}
