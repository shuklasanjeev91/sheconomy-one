import type { AccessTier } from '~/lib/auth/access'
import { canAccessFeature } from '~/lib/auth/access'
import { buildSignInUrl } from '~/lib/auth/redirect'
import { appRoutes, classRoutes, communityRoutes, coWorkRoutes } from '~/lib/routes'

import type { SearchScope } from '~/lib/search/types'

const COMMERCE_SCOPES: SearchScope[] = ['listings', 'categories', 'shops']
const COMMUNITY_SCOPES: SearchScope[] = ['people', 'companies', 'groups', 'jobs', 'posts']
const CLASS_SCOPES: SearchScope[] = ['programs']
const COWORK_SCOPES: SearchScope[] = ['meetings']

export function canAccessSearchScope(tier: AccessTier, scope: SearchScope): boolean {
  if (scope === 'all' || COMMERCE_SCOPES.includes(scope)) return true
  if (COMMUNITY_SCOPES.includes(scope)) return canAccessFeature(tier, 'community')
  if (CLASS_SCOPES.includes(scope)) return canAccessFeature(tier, 'class')
  if (COWORK_SCOPES.includes(scope)) return canAccessFeature(tier, 'co-work')
  return false
}

export function availableSearchScopes(tier: AccessTier): SearchScope[] {
  const scopes: SearchScope[] = ['all', ...COMMERCE_SCOPES]
  if (canAccessFeature(tier, 'community')) {
    scopes.push(...COMMUNITY_SCOPES)
  }
  if (canAccessFeature(tier, 'class')) {
    scopes.push(...CLASS_SCOPES)
  }
  if (canAccessFeature(tier, 'co-work')) {
    scopes.push(...COWORK_SCOPES)
  }
  return scopes
}

export function blockedSearchScopes(tier: AccessTier): SearchScope[] {
  return [...COMMUNITY_SCOPES, ...CLASS_SCOPES, ...COWORK_SCOPES].filter(
    (scope) => !canAccessSearchScope(tier, scope),
  )
}

/** Where to send the user when a scope is gated. */
export function searchScopeGateHref(tier: AccessTier, scope: SearchScope): string {
  if (COMMUNITY_SCOPES.includes(scope)) {
    if (tier === 'guest') return String(buildSignInUrl(String(communityRoutes.people)))
    return String(appRoutes.verifyGender)
  }
  if (CLASS_SCOPES.includes(scope) && tier === 'guest') {
    return String(buildSignInUrl(String(classRoutes.home)))
  }
  if (COWORK_SCOPES.includes(scope) && tier === 'guest') {
    return String(buildSignInUrl(String(coWorkRoutes.meetings)))
  }
  return String(appRoutes.signIn)
}

export function scopesToQuery(scope: SearchScope, tier: AccessTier): SearchScope[] {
  if (scope === 'all') {
    return availableSearchScopes(tier).filter((item) => item !== 'all')
  }
  return canAccessSearchScope(tier, scope) ? [scope] : []
}

export type { AccessTier }
