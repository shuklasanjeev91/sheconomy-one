import type { ReactNode } from 'react'
import { Redirect } from 'one'

import { SignInPanel } from '~/components/auth/SignInPanel'
import { PageCenter } from '~/components/layout'
import { Spinner } from '~/components/ui'
import { useAccess } from '~/hooks/useAccess'

type RequireShopAccessProps = {
  children: ReactNode
  redirectTo?: string
}

/** Seller dashboard — verified female members only. */
export function RequireShopAccess({ children, redirectTo = '/my-shops' }: RequireShopAccessProps) {
  const { isLoading, isGuest, canManageShops, getDeniedRedirect } = useAccess()

  if (isLoading) {
    return (
      <PageCenter>
        <Spinner size="large" />
      </PageCenter>
    )
  }

  if (isGuest) {
    return <SignInPanel returnTo={redirectTo} />
  }

  if (!canManageShops) {
    return <Redirect href={getDeniedRedirect(redirectTo)} />
  }

  return <>{children}</>
}