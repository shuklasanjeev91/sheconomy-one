import { requiresGenderVerification } from '~/config/route-protection.config'
import { GENDER_VERIFICATION_PROMPT } from '~/lib/gender-verification/constants'
import { getLastSafeAppPath } from '~/lib/gender-verification/route-memory'
import { commerceRoutes } from '~/lib/routes'

/** Redirect target that opens the access-restricted modal via query flag. */
export function buildVerificationDeniedRedirect(preferredPath?: string): string {
  const { restrictedQueryParam, restrictedQueryValue } = GENDER_VERIFICATION_PROMPT
  let target = preferredPath ?? getLastSafeAppPath()
  if (!target || requiresGenderVerification(target)) {
    target = String(commerceRoutes.home)
  }
  const separator = target.includes('?') ? '&' : '?'
  return `${target}${separator}${restrictedQueryParam}=${restrictedQueryValue}`
}
