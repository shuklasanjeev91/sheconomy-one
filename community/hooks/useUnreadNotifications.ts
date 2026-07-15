import { useCallback, useEffect, useState } from 'react'

import {
  getUnreadCount,
  subscribeUnreadCountChanged,
} from '~/community/lib/notifications'
import { supabase } from '~/lib/supabase/client'
import { useSupabase } from '~/providers/SupabaseProvider'

/** Live unread notification badge count (poll + realtime for all platforms). */
export function useUnreadNotifications() {
  const { user } = useSupabase()
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    if (!user) {
      setCount(0)
      return
    }
    const value = await getUnreadCount(user.id)
    setCount(value)
  }, [user])

  useEffect(() => {
    void refresh()
    if (!user?.id) return

    const interval = setInterval(() => {
      void refresh()
    }, 60_000)

    const unsubscribe = subscribeUnreadCountChanged(() => {
      void refresh()
    })

    const channel = supabase
      .channel(`notifications-unread:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${user.id}`,
        },
        () => {
          void refresh()
        },
      )
      .subscribe()

    return () => {
      clearInterval(interval)
      unsubscribe()
      void supabase.removeChannel(channel)
    }
  }, [refresh, user?.id])

  return { count, refresh }
}
