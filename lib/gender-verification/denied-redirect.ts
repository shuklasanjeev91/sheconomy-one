import { requiresGenderVerification } from '~/config/route-protection.config'
import { isSafeReturnPath } from '~/lib/auth/redirect'
import { GENDER_VERIFICATION_PROMPT } from '~/lib/gender-verification/constants'
import { getLastSafeAppPath } from '~/lib/gender-verification/route-memory'
import {
  commerceRoutes,
  isChatPath,
  isCommunityPath,
  isCreateShopPath,
} from '~/lib/routes'

/** Community, Chat, and Create store — open Human verification on intent. */
export function isHumanVerificationIntentPath(pathname: string): boolean {
  return isCommunityPath(pathname) || isChatPath(pathname) || isCreateShopPath(pathname)
}

function resolveSafeBrowseTarget(preferredPath?: string): string {
  let target = preferredPath ?? getLastSafeAppPath()
  if (
    !target ||
    requiresGenderVerification(target) ||
    isCreateShopPath(target) ||
    isHumanVerificationIntentPath(target)
  ) {
    target = String(commerceRoutes.home)
  }
  return target
}

/** Redirect target that opens the access-restricted modal via query flag. */
export function buildVerificationDeniedRedirect(preferredPath?: string): string {
  const { restrictedQueryParam, restrictedQueryValue } = GENDER_VERIFICATION_PROMPT
  const target = resolveSafeBrowseTarget(preferredPath)
  const separator = target.includes('?') ? '&' : '?'
  return `${target}${separator}${restrictedQueryParam}=${restrictedQueryValue}`
}

type HumanVerificationOpenOptions = {
  /** Safe page to land on while the modal opens (defaults to last safe / commerce). */
  preferredPath?: string
  /** Where to send the member after a successful Human verification. */
  returnTo?: string
}

/** Redirect that opens Human verification directly (`?human=verify`). */
export function buildHumanVerificationOpenRedirect(
  options?: HumanVerificationOpenOptions | string,
): string {
  const opts: HumanVerificationOpenOptions =
    typeof options === 'string' ? { returnTo: options } : (options ?? {})

  const { verifyQueryParam, verifyQueryValue, returnToQueryParam } = GENDER_VERIFICATION_PROMPT
  const target = resolveSafeBrowseTarget(opts.preferredPath)
  const parts = [`${verifyQueryParam}=${verifyQueryValue}`]

  if (opts.returnTo && isSafeReturnPath(opts.returnTo)) {
    parts.push(`${returnToQueryParam}=${encodeURIComponent(opts.returnTo)}`)
  }

  const separator = target.includes('?') ? '&' : '?'
  return `${target}${separator}${parts.join('&')}`
}
