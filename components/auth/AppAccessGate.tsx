import type { ReactNode } from 'react'
import { Redirect, usePathname } from 'one'

import { SignInPanel } from '~/components/auth/SignInPanel'
import { PageCenter } from '~/components/layout'
import { Spinner } from '~/components/ui'
import { getGuestSignInReturnTo } from '~/lib/auth/access'
import { useAccess } from '~/hooks/useAccess'

type AppAccessGateProps = {
  children: ReactNode
}

/** Redirects users away from routes their access tier cannot use. */
export function AppAccessGate({ children }: AppAccessGateProps) {
  const pathname = usePathname()
  const { tier, isLoading, canAccessPath, getDeniedRedirect } = useAccess()

  if (isLoading) {
    return (
      <PageCenter>
        <Spinner size="large" />
      </PageCenter>
    )
  }

  const guestSignInReturnTo = getGuestSignInReturnTo(tier, pathname)
  if (guestSignInReturnTo) {
    return <SignInPanel returnTo={guestSignInReturnTo} />
  }

  if (!canAccessPath(pathname)) {
    return <Redirect href={getDeniedRedirect(pathname)} />
  }

  return <>{children}</>
}