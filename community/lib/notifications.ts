import { supabase } from '~/lib/supabase/client'

export const NOTIFICATION_PAGE_SIZE = 30

export type AppNotification = {
  id: string
  title: string
  message: string
  type: string
  category: string
  read: boolean | null
  created_at: string | null
  action_url: string | null
  image_url: string | null
  context_id: string | null
  context_type: string | null
}

export async function fetchNotifications(
  userId: string,
  page = 0,
): Promise<{ items: AppNotification[]; hasMore: boolean; error: string | null }> {
  const from = page * NOTIFICATION_PAGE_SIZE
  const to = from + NOTIFICATION_PAGE_SIZE - 1

  const { data, error, count } = await supabase
    .from('notifications')
    .select('id, title, message, type, category, read, created_at, action_url, image_url, context_id, context_type', {
      count: 'exact',
    })
    .eq('recipient_id', userId)
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
