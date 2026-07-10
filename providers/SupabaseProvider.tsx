import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { Platform } from 'react-native'
import type { Session, User } from '@supabase/supabase-js'

import { supabase } from '~/lib/supabase'

type SupabaseContextValue = {
  session: Session | null
  user: User | null
  isLoading: boolean
}

const SupabaseContext = createContext<SupabaseContextValue | null>(null)

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(Platform.OS !== 'web')

  useEffect(() => {
    let isMounted = true

    const timeout = Platform.OS === 'web' ? null : setTimeout(() => {
      if (isMounted) setIsLoading(false)
    }, 2000)

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!isMounted) return
        setSession(session)
        setIsLoading(false)
      })
      .catch(() => {
        if (isMounted) setIsLoading(false)
      })
      .finally(() => {
        if (timeout) clearTimeout(timeout)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setIsLoading(false)
    })

    return () => {
      isMounted = false
      if (timeout) clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

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