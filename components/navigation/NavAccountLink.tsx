import type { Href } from 'one'

import { AuthButton } from '~/components/auth'

type NavAccountLinkProps = {
  href: Href
  displayName?: string
  avatarUrl?: string | null
  isAuthenticated: boolean
}

/** @deprecated Use `AuthButton` — kept for legacy imports. */
export function NavAccountLink(_props: NavAccountLinkProps) {
  return <AuthButton variant="header" />
}
