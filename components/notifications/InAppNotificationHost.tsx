import { useEffect, useRef } from 'react'

import { pathFromNotificationUrl } from '~/lib/notifications/push-config'
import { resolveMarketplaceTrustNotificationPath } from '~/lib/notifications/marketplace-notification-path'
import { INVALIDATION_TOPICS, invalidateCache } from '~/lib/cache/invalidation'
import { navigateApp } from '~/lib/platform/navigate'
import { supabase } from '~/lib/supabase/client'
import { useAppToast } from '~/components/ui'
import { useSupabase } from '~/providers/SupabaseProvider'

type LiveNotification = {
  id: string
  title: string | null
  message: string | null
  action_url: string | null
  channels: string[] | null
  type?: string | null
  context_type?: string | null
  context_id?: string | null
}

function isCallNotification(row: LiveNotification) {
  const type = (row.type ?? '').toLowerCase()
  return type === 'incoming_call' || type.includes('incoming_call')
}

/**
 * Cross-platform in-app surface: when a notification row lands, show a toast
 * on web / iOS / Android and allow tap-through via deep link.
 */
export function InAppNotificationHost() {
  const { user } = useSupabase()
  const toast = useAppToast()
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

          // Incoming calls use CallOverlay instead of a toast.
          if (isCallNotification(row)) return

          const channels = (row.channels ?? []).map((c) => c.toLowerCase())
          if (channels.length > 0 && !channels.includes('in_app')) return

          const type = (row.type ?? '').toLowerCase()
          if (type === 'profile_viewed') {
            invalidateCache(INVALIDATION_TOPICS.communityProfileViews)
          }
          if (type === 'hashtag_post') {
            invalidateCache(INVALIDATION_TOPICS.communityHashtagFollows)
          }
          if (
            type.includes('return') ||
            type.includes('refund') ||
            type.includes('rto') ||
            type.includes('exchange')
          ) {
            invalidateCache(INVALIDATION_TOPICS.commerceOrders)
          }

          const title = row.title?.trim() || 'New notification'
          const message = row.message?.trim() || undefined
          const path =
            resolveMarketplaceTrustNotificationPath({
              type: row.type,
              contextType: row.context_type,
              contextId: row.context_id,
              actionUrl: row.action_url,
            }) || pathFromNotificationUrl(row.action_url)

          toast.show(title, {
            message,
            tone: 'info',
            duration: 5500,
            onPress: path
              ? () => {
                  try {
                    navigateApp(path)
                  } catch {
                    // ignore navigation failures
                  }
                }
              : undefined,
          })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [toast, user?.id])

  return null
}
