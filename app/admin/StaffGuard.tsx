import type { ReactNode } from 'react'
import { usePathname } from 'one'

import { AuthSignInFlow } from '~/components/auth/AuthSignInFlow'
import { AccessDenied } from '~/components/auth/RouteGuard'
import { PageCenter } from '~/components/layout'
import { Spinner } from '~/components/ui'
import { useAuth } from '~/hooks/useAuth'
import { useProfile } from '~/hooks/useProfile'

import { canAccessStaffConsole, readStaffRole } from '~/app/admin/staff-console'

/** Admin chrome only — members and vendors never enter. */
export function StaffGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { profile, isLoading: profileLoading } = useProfile()
  const isChecking = authLoading || (isAuthenticated && profileLoading)

  if (isChecking) {
    return (
      <PageCenter>
        <Spinner size="large" />
      </PageCenter>
    )
  }

  if (!isAuthenticated) {
    return <AuthSignInFlow returnTo={pathname || '/admin'} />
  }

  const role = readStaffRole(profile?.role)
  if (!canAccessStaffConsole(role)) {
    return (
      <AccessDenied
        message="You don't have permission to access this area."
        homeHref="/"
      />
    )
  }

  return <>{children}</>
}
