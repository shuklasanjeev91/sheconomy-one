import { useEffect, useRef } from 'react'
import { useRouter } from 'one'

import { pathFromNotificationUrl } from '~/lib/notifications/push-config'
import { supabase } from '~/lib/supabase/client'
import { useAppToast } from '~/components/ui'
import { useSupabase } from '~/providers/SupabaseProvider'

type LiveNotification = {
  id: string
  title: string | null
  message: string | null
  action_url: string | null
  channels: string[] | null
}

/**
 * Cross-platform in-app surface: when a notification row lands, show a toast
 * on web / iOS / Android and allow tap-through via deep link.
 */
export function InAppNotificationHost() {
  const { user } = useSupabase()
  const toast = useAppToast()
  const router = useRouter()
  const seenRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`in-app-toasts:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as LiveNotification
          if (!row?.id || seenRef.current.has(row.id)) return
          seenRef.current.add(row.id)

          const channels = (row.channels ?? []).map((c) => c.toLowerCase())
          if (channels.length > 0 && !channels.includes('in_app')) return

          const title = row.title?.trim() || 'New notification'
          const message = row.message?.trim() || undefined
          toast.show(title, { message, tone: 'info', duration: 5500 })

          const path = pathFromNotificationUrl(row.action_url)
          // Soft navigation hint: user can open the notifications inbox anytime.
          if (path && seenRef.current.size <= 1) {
            // no auto-navigate — toast only (avoid hijacking UX)
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [router, toast, user?.id])

  return null
}
