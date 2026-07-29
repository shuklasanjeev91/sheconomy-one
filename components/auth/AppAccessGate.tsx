import type { ReactNode } from 'react'
import { Platform } from 'react-native'
import { usePathname } from 'one'

import { SpaRedirect } from '~/components/navigation/SpaRedirect'
import { AuthSignInFlow } from '~/components/auth/AuthSignInFlow'
import { PageCenter } from '~/components/layout'
import { Spinner, YStack } from '~/components/ui'
import { canAccessPath as checkAccessPath, getGuestSignInReturnTo } from '~/lib/auth/access'
import { useAccess } from '~/hooks/useAccess'
import { useAppLayout } from '~/hooks/useAppLayout'

type AppAccessGateProps = {
  children: ReactNode
}

function Shell({ children, documentScroll }: { children: ReactNode; documentScroll: boolean }) {
  return (
    <YStack
      flex={documentScroll ? undefined : 1}
      width="100%"
      maxWidth="100%"
      alignSelf="stretch"
      minHeight={documentScroll ? undefined : 0}
      overflow={documentScroll ? 'visible' : 'hidden'}
    >
      {children}
    </YStack>
  )
}

/** Redirects users away from routes their access tier cannot use. */
export function AppAccessGate({ children }: AppAccessGateProps) {
  const pathname = usePathname()
  const { tier, isLoading, isAuthenticated, canAccessPath, getDeniedRedirect } = useAccess()
  const { isDesktopWeb } = useAppLayout()
  const useDocumentScroll = Platform.OS === 'web' && isDesktopWeb

  const guestSignInReturnTo = getGuestSignInReturnTo(tier, pathname)
  const guestCanBrowsePath =
    checkAccessPath('guest', pathname) && getGuestSignInReturnTo('guest', pathname) === null
  const guestCanBrowseWhileAuthLoads = !isAuthenticated && guestCanBrowsePath

  if (isLoading) {
    if (isAuthenticated || guestCanBrowseWhileAuthLoads || guestCanBrowsePath) {
      return <Shell documentScroll={useDocumentScroll}>{children}</Shell>
    }
    return (
      <PageCenter>
        <Spinner size="large" />
      </PageCenter>
    )
  }

  if (guestSignInReturnTo) {
    return <AuthSignInFlow returnTo={guestSignInReturnTo} />
  }

  if (!canAccessPath(pathname)) {
    return <SpaRedirect href={getDeniedRedirect(pathname)} />
  }

  return <Shell documentScroll={useDocumentScroll}>{children}</Shell>
}
