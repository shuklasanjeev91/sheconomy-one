import { useEffect } from 'react'

import { scheduleAppBootstrapPrefetch } from '~/lib/bootstrap/app-prefetch'
import { warmCriticalAppCaches } from '~/lib/bootstrap/warm-app-cache'
import { useSupabase } from '~/providers/SupabaseProvider'

// Web: hydrate localStorage → memory before first paint so feed hooks can peek.
warmCriticalAppCaches()

/** Prefetch primary tab data after first paint (web + native). */
export function AppBootstrapPrefetch() {
  const { user } = useSupabase()

  useEffect(() => {
    warmCriticalAppCaches()
    return scheduleAppBootstrapPrefetch(user?.id ?? null)
  }, [user?.id])

  return null
}
