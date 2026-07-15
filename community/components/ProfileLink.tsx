import type { ReactNode } from 'react'
import { AppLink } from '~/components/navigation/AppLink'

import { routes } from '~/lib/routes'

type ProfileLinkProps = {
  userId?: string | null
  username?: string | null
  children: ReactNode
}

export function profilePath(userId?: string | null, username?: string | null) {
  const handle = username?.trim() || userId?.trim()
  return handle ? routes.userProfile(handle) : routes.profile
}

export function ProfileLink({ userId, username, children }: ProfileLinkProps) {
  const handle = username?.trim() || userId?.trim()
  if (!handle) return <>{children}</>

  return (
    <AppLink href={routes.userProfile(handle)} asChild>
      {children}
    </AppLink>
  )
}