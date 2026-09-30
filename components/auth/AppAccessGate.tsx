import type { ReactNode } from 'react'
import { Platform } from 'react-native'
import { usePathname } from 'one'

import { SpaRedirect } from '~/components/navigation/SpaRedirect'
import { AuthSignInFlow } from '~/components/auth/AuthSignInFlow'
import { ProfileUnavailable } from '~/components/auth/ProfileUnavailable'
import { PageCenter } from '~/components/layout'
import { Spinner, YStack } from '~/components/ui'
import { canAccessPath as checkAccessPath, getGuestSignInReturnTo } from '~/lib/auth/access'
import { isChatPath, isCommunityPath, isCreateShopPath } from '~/lib/routes'
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

function Loading() {
  return (
    <PageCenter>
      <Spinner size="large" />
    </PageCenter>
  )
}

function pathNeedsAuthOrVerify(pathname: string): boolean {
  return (
    getGuestSignInReturnTo('guest', pathname) != null ||
    isCommunityPath(pathname) ||
    isChatPath(pathname) ||
    isCreateShopPath(pathname) ||
    !checkAccessPath('male', pathname, false)
  )
}

/** Redirects users away from routes their access tier cannot use. */
export function AppAccessGate({ children }: AppAccessGateProps) {
  const pathname = usePathname()
  const {
    tier,
    isLoading,
    isAuthenticated,
    isProfileKnown,
    isProfileConfirmed,
    isProfileUnavailable,
    canAccessPath,
    getDeniedRedirect,
  } = useAccess()
  const { isDesktopWeb } = useAppLayout()
  const useDocumentScroll = Platform.OS === 'web' && isDesktopWeb

  const guestSignInReturnTo = getGuestSignInReturnTo(tier, pathname)
  const guestCanBrowsePath =
    checkAccessPath('guest', pathname) && getGuestSignInReturnTo('guest', pathname) === null
  const guestCanBrowseWhileAuthLoads = !isAuthenticated && guestCanBrowsePath

  if (isLoading) {
    // Authenticated but profile still loading — don't paint women-first / create-shop trees.
    if (isAuthenticated && pathNeedsAuthOrVerify(pathname)) {
      return <Loading />
    }
    if (isAuthenticated || guestCanBrowseWhileAuthLoads || guestCanBrowsePath) {
      return <Shell documentScroll={useDocumentScroll}>{children}</Shell>
    }
    return <Loading />
  }

  // The fetch timeout settles the store with an empty profile, which reads as the
  // limited tier. Redirecting on that sent verified members to ?gender=restricted
  // while their own row was still in flight, so wait for a real answer instead.
  if (isAuthenticated && !isProfileKnown) {
    if (pathNeedsAuthOrVerify(pathname)) {
      return isProfileUnavailable ? <ProfileUnavailable /> : <Loading />
    }
    return <Shell documentScroll={useDocumentScroll}>{children}</Shell>
  }

  if (guestSignInReturnTo) {
    return <AuthSignInFlow returnTo={guestSignInReturnTo} />
  }

  if (!canAccessPath(pathname)) {
    // A warm cache settles the store before the server answers, so denying here
    // would bounce verified members to `?gender=restricted` on every reload.
    // Wait for the real row before taking access away.
    if (isAuthenticated && !isProfileConfirmed) {
      if (!pathNeedsAuthOrVerify(pathname)) {
        return <Shell documentScroll={useDocumentScroll}>{children}</Shell>
      }
      return isProfileUnavailable ? <ProfileUnavailable /> : <Loading />
    }
    // `children` holds the root <Slot />; the router refuses to navigate while
    // it is unmounted, so keep it mounted (hidden) or the redirect never runs.
    return (
      <>
        <YStack display="none" aria-hidden>
          {children}
        </YStack>
        <SpaRedirect href={getDeniedRedirect(pathname)} />
      </>
    )
  }

  return <Shell documentScroll={useDocumentScroll}>{children}</Shell>
}
