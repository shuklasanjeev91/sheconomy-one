import { Platform } from 'react-native'

import { useAppLayout } from '~/hooks/useAppLayout'

/**
 * True when auth should use the desktop split layout (no mobile onboarding).
 * Uses `useAppLayout` — web breakpoints come from viewport `matchMedia`.
 */
export function useAuthDesktopLayout(): boolean {
  const { isDesktop, isMediaHydrated } = useAppLayout()

  if (Platform.OS === 'web') {
    return isDesktop
  }

  return isMediaHydrated ? isDesktop : false
}
