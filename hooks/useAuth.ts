import { useCallback } from 'react'
import { usePathname, useRouter } from 'one'

import {
  revokeAllLoginSessions,
  revokeCurrentLoginSession,
  revokeOtherLoginSessions,
} from '~/features/auth/services/login-sessions'
import { needsProfileOnboarding } from '~/features/auth/services/onboarding'
import { enrichProfileFromAuth } from '~/features/auth/services/profile-enrichment'
import { getAccessTier, sanitizeReturnPath } from '~/lib/auth/access'
import { buildSignInUrl, getReturnToFromLocation, isSafeReturnPath } from '~/lib/auth/redirect'
import { signOut as supabaseSignOut, type SignOutScope } from '~/lib/supabase/auth'
import { supabase } from '~/lib/supabase'
import { appRoutes, routes } from '~/lib/routes'
import { clearCachedProfile } from '~/lib/profile/profile-cache'
import { persistor, resetStore, store } from '~/lib/store'
import { useSupabase } from '~/providers/SupabaseProvider'

async function clearLocalAppState() {
  store.dispatch(resetStore())
  try {
    await persistor.purge()
  } catch {
    // Purge failures are non-fatal — the in-memory reset already applied.
  }
  await clearCachedProfile()
}

export type CompleteSignInOptions = {
  provider?: string | null
  /** Skip the /auth/complete-profile gate (after wizard finishes). */
  skipOnboardingGate?: boolean
  /** Route through contact import after onboarding for brand-new accounts. */
  isNewUser?: boolean
}

export function useAuth() {
  const router = useRouter()
  const pathname = usePathname()
  const { session, user, isLoading } = useSupabase()

  const isAuthenticated = !!user

  const signIn = useCallback(
    (returnTo?: string | null) => {
      router.push(buildSignInUrl(returnTo ?? pathname))
    },
    [pathname, router],
  )

  const signOut = useCallback(
    async (options?: { scope?: SignOutScope }) => {
      const scope = options?.scope ?? 'local'

      if (scope === 'global') {
        await revokeAllLoginSessions()
      } else if (scope === 'others') {
        await revokeOtherLoginSessions()
        const { error } = await supabaseSignOut({ scope: 'others' })
        return { error: error?.message ?? null }
      } else {
        await revokeCurrentLoginSession()
      }

      const { error } = await supabaseSignOut({ scope })
      await clearLocalAppState()
      router.push(routes.home)
      return { error: error?.message ?? null }
    },
    [router],
  )

  const signOutLocal = useCallback(() => signOut({ scope: 'local' }), [signOut])
  const signOutGlobal = useCallback(() => signOut({ scope: 'global' }), [signOut])
  const signOutOthers = useCallback(() => signOut({ scope: 'others' }), [signOut])

  const completeSignIn = useCallback(
    async (explicitReturnTo?: string | null, options?: CompleteSignInOptions) => {
      const fromQuery = getReturnToFromLocation()
      const returnTo =
        explicitReturnTo && isSafeReturnPath(explicitReturnTo)
          ? explicitReturnTo
          : String(fromQuery)

      const { profile } = await enrichProfileFromAuth()

      if (!options?.skipOnboardingGate && needsProfileOnboarding(profile)) {
        router.push({
          pathname: '/auth/complete-profile',
          params: {
            returnTo: returnTo ?? '',
            isNewUser: options?.isNewUser ? '1' : '0',
          },
        } as never)
        return
      }

      if (options?.isNewUser) {
        router.push({
          pathname: String(appRoutes.importContacts),
          params: { returnTo: returnTo ?? '' },
        } as never)
        return
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()

      let tier = getAccessTier(!!session?.user, false, false)

      if (session?.user?.id) {
        const { data } = await supabase
          .from('profiles')
          .select('gender, is_verified')
          .eq('id', session.user.id)
          .maybeSingle()
        tier = getAccessTier(true, data?.gender, data?.is_verified)
        router.push(sanitizeReturnPath(returnTo, tier, data?.is_verified) as import('one').Href)
        return
      }

      router.push(sanitizeReturnPath(returnTo, tier) as import('one').Href)
    },
    [router],
  )

  return {
    session,
    user,
    isLoading,
    isAuthenticated,
    signIn,
    signOut,
    signOutLocal,
    signOutGlobal,
    signOutOthers,
    completeSignIn,
  }
}
