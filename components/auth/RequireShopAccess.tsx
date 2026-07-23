import type { ReactNode } from 'react'

import { AuthSignInFlow } from '~/components/auth/AuthSignInFlow'
import { PageCenter } from '~/components/layout'
import { Spinner } from '~/components/ui'
import { useAccess } from '~/hooks/useAccess'

type RequireShopAccessProps = {
  children: ReactNode
  redirectTo?: string
}

/** Seller dashboard — sign in required; guests see inline auth. */
export function RequireShopAccess({ children, redirectTo = '/vendor/myshop' }: RequireShopAccessProps) {
  const { isLoading, isGuest } = useAccess()

  if (isLoading) {
    return (
      <PageCenter>
        <Spinner size="large" />
      </PageCenter>
    )
  }

  if (isGuest) {
    return <AuthSignInFlow returnTo={redirectTo} />
  }

  return <>{children}</>
}