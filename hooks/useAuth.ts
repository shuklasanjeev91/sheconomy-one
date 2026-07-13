import { useCallback } from 'react'
import { usePathname, useRouter } from 'one'

import { getAccessTier, sanitizeReturnPath } from '~/lib/auth/access'
import { buildSignInUrl, getReturnToFromLocation, isSafeReturnPath } from '~/lib/auth/redirect'
import { signOut as supabaseSignOut } from '~/lib/supabase/auth'
import { supabase } from '~/lib/supabase'
import { routes } from '~/lib/routes'
import { persistor, resetStore, store } from '~/lib/store'
import { useSupabase } from '~/providers/SupabaseProvider'

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

  const signOut = useCallback(async () => {
    const { error } = await supabaseSignOut()
    // Wipe cached per-account state so the next user doesn't inherit the
    // previous session's shops/listings/etc. (reset in-memory, then clear
    // persisted storage).
    store.dispatch(resetStore())
    try {
      await persistor.purge()
    } catch {
      // Purge failures are non-fatal — the in-memory reset already applied.
    }
    router.replace(routes.home)
    return { error: error?.message ?? null }
  }, [router])

  const completeSignIn = useCallback(async (explicitReturnTo?: string | null) => {
    const fromQuery = getReturnToFromLocation()
    const returnTo =
      explicitReturnTo && isSafeReturnPath(explicitReturnTo) ? explicitReturnTo : fromQuery
    const {
      data: { session },
    } = await supabase.auth.getSession()

    let tier = getAccessTier(!!session?.user, false)

    if (session?.user?.id) {
      const { data } = await supabase
        .from('profiles')
        .select('gender')
        .eq('id', session.user.id)
        .maybeSingle()
      tier = getAccessTier(true, data?.gender)
    }

    router.replace(sanitizeReturnPath(returnTo, tier) as import('one').Href)
  }, [router])

  return {
    session,
    user,
    isLoading,
    isAuthenticated,
    signIn,
    signOut,
    completeSignIn,
  }
}
