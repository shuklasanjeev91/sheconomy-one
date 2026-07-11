import { useEffect } from 'react'

import { updatePresence } from '~/chat/lib/chats'

const HEARTBEAT_MS = 45_000

/** Marks the signed-in user online while any chat surface is mounted. */
export function usePresence(userId: string | null | undefined) {
  useEffect(() => {
    if (!userId) return

    let active = true
    void updatePresence(userId, true)

    const interval = setInterval(() => {
      if (active) void updatePresence(userId, true)
    }, HEARTBEAT_MS)

    return () => {
      active = false
      clearInterval(interval)
      void updatePresence(userId, false)
    }
  }, [userId])
}
