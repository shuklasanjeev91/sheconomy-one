import { useCallback, useEffect, useState } from 'react'

import { getUnreadCount } from '~/community/lib/notifications'
import { useSupabase } from '~/providers/SupabaseProvider'

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
    refresh()
    const interval = setInterval(refresh, 60_000)
    return () => clearInterval(interval)
  }, [refresh])

  return { count, refresh }
}
