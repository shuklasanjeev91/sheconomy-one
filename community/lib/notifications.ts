import { resolveMarketplaceTrustNotificationPath } from '~/lib/notifications/marketplace-notification-path'
import { pathFromNotificationUrl } from '~/lib/notifications/push-config'
import { supabase } from '~/lib/supabase/client'
import {
  appRoutes,
  chatRoutes,
  classRoutes,
  coWorkRoutes,
  commerceRoutes,
  communityRoutes,
  vendorRoutes,
} from '~/lib/routes'

export const NOTIFICATION_PAGE_SIZE = 30

export type AppNotification = {
  id: string
  title: string
  message: string
  type: string
  category: string
  platform: string | null
  read: boolean | null
  created_at: string | null
  action_url: string | null
  image_url: string | null
  context_id: string | null
  context_type: string | null
}

type UnreadListener = () => void
const unreadListeners = new Set<UnreadListener>()

/** Notify header badges to re-fetch unread count immediately. */
export function notifyUnreadCountChanged() {
  for (const listener of unreadListeners) listener()
}

export function subscribeUnreadCountChanged(listener: UnreadListener) {
  unreadListeners.add(listener)
  return () => {
    unreadListeners.delete(listener)
  }
}

/** Resolve in-app path from action_url, with type/context fallbacks. */
export function resolveNotificationPath(notification: AppNotification): string | null {
  const contextType = (notification.context_type ?? '').toLowerCase()
  const contextId = notification.context_id?.trim() || null
  const type = (notification.type ?? '').toLowerCase()

  const trustPath = resolveMarketplaceTrustNotificationPath({
    type: notification.type,
    contextType: notification.context_type,
    contextId: notification.context_id,
    actionUrl: notification.action_url,
  })
  if (trustPath) return trustPath

  // Profile links in action_url embed the username from send time, which
  // breaks after a rename. The context uuid is stable, so prefer it.
  if ((contextType === 'profile' || contextType === 'user') && contextId) {
    return communityRoutes.userProfile(contextId)
  }

  const fromUrl = pathFromNotificationUrl(notification.action_url)
  if (fromUrl) return fromUrl

  if (contextId) {
    if (
      contextType === 'post' ||
      contextType === 'community_post' ||
      type.includes('post') ||
      type.includes('comment') ||
      type.includes('reaction') ||
      type.includes('repost') ||
      type.includes('mention')
    ) {
      return communityRoutes.post(contextId)
    }
    if (
      contextType === 'chat' ||
      contextType === 'chat_room' ||
      contextType === 'conversation' ||
      type === 'message_received' ||
      type === 'new_message'
    ) {
      return chatRoutes.conversation(contextId)
    }
    if (contextType === 'order' || type.includes('order')) {
      if (type.includes('vendor') || type.includes('seller') || type.includes('return_requested')) {
        return vendorRoutes.orders
      }
      // Prefer the exact order detail when context_id is an order uuid.
      if (contextId) return commerceRoutes.order(contextId)
      return commerceRoutes.orders
    }
    if (contextType === 'listing' || type.includes('listing') || type.includes('stock')) {
      return commerceRoutes.listing(contextId)
    }
    if (contextType === 'shop') {
      return commerceRoutes.shop(contextId)
    }
    if (contextType === 'job') {
      return communityRoutes.job(contextId)
    }
    if (contextType === 'group' || contextType === 'community_group') {
      return communityRoutes.group(contextId)
    }
    if (contextType === 'company' || contextType === 'company_page') {
      return communityRoutes.company(contextId)
    }
    if (contextType === 'event' || contextType === 'community_event') {
      return communityRoutes.event(contextId)
    }
    if (contextType === 'meeting' || type.startsWith('meeting_')) {
      return coWorkRoutes.meeting(contextId)
    }
    if (contextType === 'class' || contextType === 'course' || type.startsWith('class_')) {
      return classRoutes.program(contextId)
    }
    if (
      contextType === 'profile' ||
      contextType === 'user' ||
      type.includes('follow') ||
      type.includes('connection') ||
      type.includes('endorsement') ||
      type.includes('recommendation')
    ) {
      return communityRoutes.userProfile(contextId)
    }
  }

  if (type.includes('connection') || type.includes('intro')) return communityRoutes.network
  if (type.includes('cart')) return commerceRoutes.cart
  if (type.startsWith('meeting_') || notification.category === 'co-work' || notification.category === 'cowork') {
    return coWorkRoutes.home
  }
  if (type.startsWith('class_')) return classRoutes.home
  if (type.includes('message')) return chatRoutes.home
  if (notification.platform === 'community') return communityRoutes.home
  if (notification.platform === 'marketplace') return commerceRoutes.home

  return appRoutes.notifications
}

/** Product filter keys used by the unified inbox. */
export type NotificationProductFilter =
  | ''
  | 'commerce'
  | 'community'
  | 'chat'
  | 'class'
  | 'cowork'

export const NOTIFICATION_PRODUCT_FILTERS: Array<{
  key: NotificationProductFilter
  label: string
}> = [
  { key: '', label: 'All' },
  { key: 'commerce', label: 'Shop' },
  { key: 'community', label: 'Community' },
  { key: 'chat', label: 'Chat' },
  { key: 'class', label: 'Class' },
  { key: 'cowork', label: 'Co-Work' },
]

export type NotificationFilters = {
  /** @deprecated Prefer `product` for cross-tab inbox filters. */
  category?: string
  product?: NotificationProductFilter
  unreadOnly?: boolean
}

/**
 * Fan-out broadcast types about other users' activity (someone else posted,
 * opened a shop, updated their profile…). These are addressed to everyone and
 * drown out notifications that are actually about the signed-in user, so the
 * inbox and the unread badge skip them.
 */
const BROADCAST_TYPES = [
  'new_post',
  'connection_new_post',
  'friend_activity',
  'new_program',
  'new_listing',
  'new_shop',
  'new_shop_alert',
  'profile_update',
]

const VENDOR_TYPES = [
  'new_order_vendor',
  'cod_order_vendor',
  'payment_received_vendor',
  'low_stock_alert_vendor',
  'listing_inquiry_seller',
  'order_confirmation_reminder_vendor',
  'order_status_update_vendor',
  'admin_vendor_registration',
  'vendor_enrollment_accepted',
  'vendor_enrollment_rejected',
]

export async function fetchNotifications(
  userId: string,
  page = 0,
  filters: NotificationFilters = {},
): Promise<{ items: AppNotification[]; hasMore: boolean; error: string | null }> {
  const from = page * NOTIFICATION_PAGE_SIZE
  const to = from + NOTIFICATION_PAGE_SIZE - 1

  let query = supabase
    .from('notifications')
    .select(
      'id, title, message, type, category, platform, read, created_at, action_url, image_url, context_id, context_type',
      { count: 'exact' },
    )
    .eq('recipient_id', userId)
    .not('type', 'in', `(${BROADCAST_TYPES.join(',')})`)

  if (filters.category) query = query.eq('category', filters.category)
  if (filters.unreadOnly) query = query.eq('read', false)

  if (filters.product === 'commerce') {
    // One "Shop" tab for all commerce: buyer + vendor. Most order/shop/listing
    // notifications are stored with platform 'unified', so match by type and
    // context too, not just platform 'marketplace'.
    query = query.or(
      [
        'platform.eq.marketplace',
        `type.in.(${VENDOR_TYPES.join(',')})`,
        'type.like.order_*',
        'type.like.shop_*',
        'type.like.listing_*',
        'type.like.cart_*',
        'type.in.(new_order,order_update,shop_follow,shop_new_follower,shop_follower_new_listing,sale_event_announcement,sale_event_enrollment_request,order_return_requested_seller,order_issue_resolved_buyer,order_refund_pending_buyer,listing_review_received_seller)',
        'context_type.in.(order,listing,shop)',
      ].join(','),
    )
  } else if (filters.product === 'community') {
    query = query.eq('platform', 'community').not('type', 'ilike', 'meeting_%')
  } else if (filters.product === 'chat') {
    query = query.or(
      'platform.eq.chat,type.eq.message_received,type.eq.new_message,context_type.eq.chat',
    )
  } else if (filters.product === 'class') {
    query = query.or('platform.eq.class,type.ilike.class_%')
  } else if (filters.product === 'cowork') {
    query = query.or(
      'type.ilike.meeting_%,category.eq.co-work,category.eq.cowork,context_type.eq.meeting',
    )
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) return { items: [], hasMore: false, error: error.message }

  const total = count ?? 0
  return {
    items: (data ?? []) as AppNotification[],
    hasMore: total ? to + 1 < total : (data?.length ?? 0) === NOTIFICATION_PAGE_SIZE,
    error: null,
  }
}

/** Distinct notification categories for a stable filter menu. */
export async function fetchNotificationCategories(userId: string): Promise<string[]> {
  const categories = new Set<string>()

  const { data: facetRows, error } = await supabase.rpc('community_notification_categories', {
    p_user: userId,
  })
  if (!error && facetRows) {
    for (const row of facetRows as { value: string }[]) {
      if (row.value) categories.add(row.value)
    }
    return Array.from(categories).sort((a, b) => a.localeCompare(b))
  }

  const { data } = await supabase
    .from('notifications')
    .select('category')
    .eq('recipient_id', userId)
    .limit(1000)

  for (const row of (data ?? []) as { category: string | null }[]) {
    if (row.category?.trim()) categories.add(row.category.trim())
  }
  return Array.from(categories).sort((a, b) => a.localeCompare(b))
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .eq('read', false)
    .not('type', 'in', `(${BROADCAST_TYPES.join(',')})`)

  return count ?? 0
}

export async function markNotificationRead(
  id: string,
  userId?: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('mark_notification_read', {
    p_notification_id: id,
    ...(userId ? { p_user_id: userId } : {}),
  })
  if (error) {
    // Fallback for environments where the RPC is unavailable.
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('id', id)
    if (updateError) return { error: updateError.message }
  }
  notifyUnreadCountChanged()
  return { error: null }
}

export async function markAllNotificationsRead(userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('mark_all_notifications_read', {
    p_user_id: userId,
  })
  if (error) {
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('recipient_id', userId)
      .eq('read', false)
    if (updateError) return { error: updateError.message }
  }
  notifyUnreadCountChanged()
  return { error: null }
}
