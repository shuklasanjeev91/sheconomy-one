import { requiresGenderVerification } from '~/config/route-protection.config'
import { commerceRoutes } from '~/lib/routes'

let lastSafePath = String(commerceRoutes.home)

/** Remember the last route that does not require human verification. */
export function rememberSafeAppPath(pathname: string) {
  if (!pathname || pathname.startsWith('/auth') || pathname.startsWith('/ui-kit')) return
  if (requiresGenderVerification(pathname)) return
  lastSafePath = pathname
}

export function getLastSafeAppPath(): string {
  return lastSafePath
}
