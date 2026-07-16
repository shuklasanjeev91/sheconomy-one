import { useEffect } from 'react'

import { scheduleAppBootstrapPrefetch } from '~/lib/bootstrap/app-prefetch'
import { useSupabase } from '~/providers/SupabaseProvider'

/** Prefetch primary tab data after first paint (web + native). */
export function AppBootstrapPrefetch() {
  const { user } = useSupabase()

  useEffect(() => scheduleAppBootstrapPrefetch(user?.id ?? null), [user?.id])

  return null
}
