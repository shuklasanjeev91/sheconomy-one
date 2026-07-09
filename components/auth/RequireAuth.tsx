import type { ReactNode } from 'react'

import { SignInPanel } from '~/components/auth/SignInPanel'
import { PageCenter } from '~/components/layout'
import { Spinner } from '~/components/ui'
import { useAuth } from '~/hooks/useAuth'

type RequireAuthProps = {
  children: ReactNode
  redirectTo?: string
}

export function RequireAuth({ children, redirectTo }: RequireAuthProps) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <PageCenter>
        <Spinner size="large" />
      </PageCenter>
    )
  }

  if (!isAuthenticated) {
    return <SignInPanel returnTo={redirectTo} />
  }

  return <>{children}</>
}