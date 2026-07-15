import type { ReactNode } from 'react'
import { Platform } from 'react-native'
import { usePathname } from 'one'

import { SpaRedirect } from '~/components/navigation/SpaRedirect'
import { AuthSignInFlow } from '~/components/auth/AuthSignInFlow'
import { PageCenter } from '~/components/layout'
import { Spinner, YStack } from '~/components/ui'
import { canAccessPath, getGuestSignInReturnTo } from '~/lib/auth/access'
import { useAccess } from '~/hooks/useAccess'
import { useAppLayout } from '~/hooks/useAppLayout'

type AppAccessGateProps = {
  children: ReactNode
}

/** Redirects users away from routes their access tier cannot use. */
export function AppAccessGate({ children }: AppAccessGateProps) {
  const pathname = usePathname()
  const { tier, isLoading, isAuthenticated, getDeniedRedirect } = useAccess()
  const { isDesktopWeb } = useAppLayout()
  const useDocumentScroll = Platform.OS === 'web' && isDesktopWeb

  const guestSignInReturnTo = getGuestSignInReturnTo(tier, pathname)
  const guestCanBrowseWhileAuthLoads =
    !isAuthenticated &&
    canAccessPath('guest', pathname) &&
    getGuestSignInReturnTo('guest', pathname) === null

  // Wait for first profile settle before tier redirects (account-switch safety).
  // Keep the previous tree mounted whenever possible — a full-screen spinner on
  // every soft navigation feels like a 5–10s hang.
  if (isLoading && !guestCanBrowseWhileAuthLoads) {
    return (
      <PageCenter>
        <Spinner size="large" />
      </PageCenter>
    )
  }

  if (!isLoading && guestSignInReturnTo) {
    return <AuthSignInFlow returnTo={guestSignInReturnTo} />
  }

  if (!canAccessPath(tier, pathname)) {
    return <SpaRedirect href={getDeniedRedirect(pathname)} />
  }

  return (
    <YStack
      // Document-scroll pages (desktop web commerce/class/co-work) must not be
      // flex-clipped — that traps content above the fold with nowhere to scroll.
      flex={useDocumentScroll ? undefined : 1}
      width="100%"
      maxWidth="100%"
      alignSelf="stretch"
      minHeight={useDocumentScroll ? undefined : 0}
      overflow={useDocumentScroll ? 'visible' : 'hidden'}
    >
      {children}
    </YStack>
  )
}