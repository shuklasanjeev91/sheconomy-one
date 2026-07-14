import { supabase } from '~/lib/supabase/client'

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

/** Product filter keys used by the unified inbox. */
export type NotificationProductFilter =
  | ''
  | 'commerce'
  | 'shop'
  | 'community'
  | 'chat'
  | 'class'
  | 'cowork'

export const NOTIFICATION_PRODUCT_FILTERS: Array<{
  key: NotificationProductFilter
  label: string
}> = [
  { key: '', label: 'All' },
  { key: 'commerce', label: 'Commerce' },
  { key: 'shop', label: 'Shop' },
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

  if (filters.category) query = query.eq('category', filters.category)
  if (filters.unreadOnly) query = query.eq('read', false)

  if (filters.product === 'commerce') {
    query = query
      .eq('platform', 'marketplace')
      .not('type', 'in', `(${VENDOR_TYPES.join(',')})`)
  } else if (filters.product === 'shop') {
    query = query.or(
      `type.in.(${VENDOR_TYPES.join(',')}),and(platform.eq.unified,type.eq.order_status_update_vendor)`,
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

  return count ?? 0
}

export async function markNotificationRead(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('id', id)
  return { error: error?.message ?? null }
}

export async function markAllNotificationsRead(userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('recipient_id', userId)
    .eq('read', false)
  return { error: error?.message ?? null }
}
