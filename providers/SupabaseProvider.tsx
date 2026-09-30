import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { AppState, Platform, type AppStateStatus } from 'react-native'
import type { Session, User } from '@supabase/supabase-js'

import { heartbeatLoginSession, recordLoginSession } from '~/features/auth/services/login-sessions'
import { completeStrayOAuthRedirect } from '~/features/auth/services/oauth'
import { enrichProfileFromAuth } from '~/features/auth/services/profile-enrichment'
import { applyPendingReferralForUser } from '~/lib/referral/invite'
import { supabase } from '~/lib/supabase'

type SupabaseContextValue = {
  session: Session | null
  user: User | null
  isLoading: boolean
}

const SupabaseContext = createContext<SupabaseContextValue | null>(null)

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let isMounted = true

    const timeout =
      Platform.OS === 'web'
        ? null
        : setTimeout(() => {
            if (isMounted) setIsLoading(false)
          }, 1_500)

    let lastHandledUserId: string | null = null

    void completeStrayOAuthRedirect()

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!isMounted) return
        setSession(session)
        setIsLoading(false)
        if (session?.user) {
          lastHandledUserId = session.user.id
          void heartbeatLoginSession()
        }
      })
      .catch(() => {
        if (isMounted) setIsLoading(false)
      })
      .finally(() => {
        if (timeout) clearTimeout(timeout)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      setIsLoading(false)
      const currentUserId = nextSession?.user?.id ?? null
      if (event === 'SIGNED_IN' && nextSession?.user) {
        const isNewUserSignIn = lastHandledUserId !== currentUserId
        lastHandledUserId = currentUserId
        if (isNewUserSignIn) {
          const provider =
            (nextSession.user.app_metadata?.provider as string | undefined) ?? null
          void recordLoginSession({ provider })
          void enrichProfileFromAuth(nextSession.user)
          void applyPendingReferralForUser(nextSession.user.id)
        }
      } else if (event === 'SIGNED_OUT') {
        lastHandledUserId = null
      }
    })

    return () => {
      isMounted = false
      if (timeout) clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session?.user?.id) return
    void applyPendingReferralForUser(session.user.id)
  }, [session?.user?.id])

  useEffect(() => {
    if (!session?.user) return

    if (Platform.OS === 'web') {
      if (typeof document === 'undefined') return
      const onVisible = () => {
        if (document.visibilityState === 'visible') {
          void heartbeatLoginSession()
        }
      }
      document.addEventListener('visibilitychange', onVisible)
      return () => document.removeEventListener('visibilitychange', onVisible)
    }

    const onChange = (state: AppStateStatus) => {
      if (state === 'active') void heartbeatLoginSession()
    }
    const sub = AppState.addEventListener('change', onChange)
    return () => sub.remove()
  }, [session?.user?.id])

  const value = useMemo<SupabaseContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
    }),
    [session, isLoading],
  )

  return (
    <SupabaseContext.Provider value={value}>{children}</SupabaseContext.Provider>
  )
}

export function useSupabase() {
  const context = useContext(SupabaseContext)

  if (!context) {
    throw new Error('useSupabase must be used within a SupabaseProvider')
  }

  return context
}
