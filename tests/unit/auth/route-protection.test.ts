import { describe, expect, it } from 'vitest'

import { requiresGenderVerification } from '~/config/route-protection.config'
import { resolveRoleAccess, resolveRouteAccess } from '~/lib/auth/route-protection'
import { USER_ROLES } from '~/lib/profile/profile.type'

describe('seller console access', () => {
  it('does not treat /vendor as a gender-restricted path', () => {
    expect(requiresGenderVerification('/vendor')).toBe(false)
    expect(requiresGenderVerification('/vendor/myshop')).toBe(false)
    expect(requiresGenderVerification('/vendor/orders')).toBe(false)
    expect(requiresGenderVerification('/create-my-shop')).toBe(true)
  })

  it('allows an unverified vendor on /vendor when gender is not required', () => {
    const decision = resolveRoleAccess(
      {
        pathname: '/vendor/myshop',
        isAuthenticated: true,
        role: USER_ROLES.VENDOR,
        gender: null,
        isVerified: false,
        allowedRoles: [USER_ROLES.ADMIN, USER_ROLES.VENDOR],
      },
      { requireGenderVerification: false },
    )
    expect(decision.status).toBe('allow')
  })

  it('lets a vendor through resolveRouteAccess without a gender redirect', () => {
    const decision = resolveRouteAccess({
      pathname: '/vendor/products',
      isAuthenticated: true,
      role: USER_ROLES.VENDOR,
      gender: false,
      isVerified: false,
    })
    expect(decision.status).toBe('allow')
  })

  it('does not auto-open human verification on direct create-shop routes', () => {
    const decision = resolveRouteAccess({
      pathname: '/create-my-shop',
      isAuthenticated: true,
      role: USER_ROLES.USER,
      gender: false,
      isVerified: false,
    })

    expect(decision.status).toBe('denied')
    if (decision.status !== 'denied') throw new Error('Expected denied for /create-my-shop')
    expect(String(decision.href)).not.toMatch(/human=verify/)
    expect(String(decision.href)).not.toMatch(/gender=restricted/)
  })
})
