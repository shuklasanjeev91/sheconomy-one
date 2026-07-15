import type { ReactNode } from 'react'
import { Platform } from 'react-native'
import { Redirect, usePathname } from 'one'

import { AuthSignInFlow } from '~/components/auth/AuthSignInFlow'
import { PageCenter } from '~/components/layout'
import { Spinner, YStack } from '~/components/ui'
import { getGuestSignInReturnTo } from '~/lib/auth/access'
import { useAccess } from '~/hooks/useAccess'
import { useAppLayout } from '~/hooks/useAppLayout'

type AppAccessGateProps = {
  children: ReactNode
}

/** Redirects users away from routes their access tier cannot use. */
export function AppAccessGate({ children }: AppAccessGateProps) {
  const pathname = usePathname()
  const { tier, isLoading, isAuthenticated, canAccessPath, getDeniedRedirect } = useAccess()
  const { isDesktopWeb } = useAppLayout()
  const useDocumentScroll = Platform.OS === 'web' && isDesktopWeb

  const guestSignInReturnTo = getGuestSignInReturnTo(tier, pathname)
  const guestCanBrowseWhileAuthLoads =
    !isAuthenticated &&
    canAccessPath('guest', pathname) &&
    getGuestSignInReturnTo('guest', pathname) === null

  // Always wait for auth/profile to settle before tier redirects. Skipping this
  // during account switch briefly treats users as male (gender unknown) and can
  // yank chat/co-work into a blank redirect state.
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
    return <Redirect href={getDeniedRedirect(pathname)} />
  }

  return (
    <YStack
      flex={useDocumentScroll ? undefined : 1}
      width="100%"
      maxWidth="100%"
      alignSelf="stretch"
      minHeight={0}
      // Avoid clipping scroll pages to a zero-height box on mobile web.
      overflow={useDocumentScroll ? 'visible' : 'hidden'}
    >
      {children}
    </YStack>
  )
}