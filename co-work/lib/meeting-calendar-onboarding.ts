import AsyncStorage from '@react-native-async-storage/async-storage'

const DISMISSED_KEY = 'sheconomy.meeting.calendarOnboarding.dismissed.v1'

export type CalendarOnboardingProvider = 'google' | 'microsoft' | 'device'

export function calendarOnboardingCopy() {
  return {
    title: 'Make scheduling simple',
    body: 'Easily access Sheconomy Meetings by connecting to your external calendar and contacts or your device calendar.',
    connect: 'Connect',
    notNow: 'Not now',
  } as const
}

export function calendarOnboardingProviderLabel(provider: CalendarOnboardingProvider): string {
  switch (provider) {
    case 'google':
      return 'Google'
    case 'microsoft':
      return 'Microsoft'
    case 'device':
      return 'Device calendar'
  }
}

export async function loadCalendarOnboardingDismissed(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(DISMISSED_KEY)) === '1'
  } catch {
    return false
  }
}

export async function dismissCalendarOnboarding(): Promise<void> {
  try {
    await AsyncStorage.setItem(DISMISSED_KEY, '1')
  } catch {
    // Best-effort preference.
  }
}
