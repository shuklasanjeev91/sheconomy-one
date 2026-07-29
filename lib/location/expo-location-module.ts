/**
 * Web/SSR stub — browser geolocation is used via `navigator.geolocation`
 * in `current-position.ts`. This module exists so SSR never loads native
 * `expo-location` bindings.
 */
export async function getForegroundPermissionsAsync() {
  return { granted: false, canAskAgain: false, status: 'undetermined' as const }
}

export async function requestForegroundPermissionsAsync() {
  return { granted: false, canAskAgain: false, status: 'denied' as const }
}

export async function getCurrentPositionAsync(_options?: unknown): Promise<never> {
  throw new Error('expo-location is not available on web')
}

export const Accuracy = {
  Lowest: 1,
  Low: 2,
  Balanced: 3,
  High: 4,
  Highest: 5,
  BestForNavigation: 6,
} as const
