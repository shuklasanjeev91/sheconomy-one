import { usePathname } from 'one'

import { getGuestSignInReturnTo } from '~/lib/auth/access'
import { useAccess } from '~/hooks/useAccess'

export function isAuthPath(pathname: string) {
  return pathname.startsWith('/auth/')
}

/** True when the app should hide chrome and show a full-screen auth experience. */
export function useAuthScreen() {
  const pathname = usePathname()
  const { tier, isLoading } = useAccess()

  if (isAuthPath(pathname)) {
    return { chromeless: true, inlineAuth: false, returnTo: null as string | null }
  }

  const returnTo = !isLoading ? getGuestSignInReturnTo(tier, pathname) : null

  return {
    chromeless: returnTo != null,
    inlineAuth: returnTo != null,
    returnTo,
  }
}
