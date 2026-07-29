import { supabase } from '~/lib/supabase/client'

export type ChannelNotificationPrefs = {
  inAppEnabled: boolean
  emailEnabled: boolean
  pushEnabled: boolean
  whatsappEnabled: boolean
}

const DEFAULT_PREFS: ChannelNotificationPrefs = {
  inAppEnabled: true,
  emailEnabled: true,
  pushEnabled: true,
  whatsappEnabled: false,
}

type PrefRow = {
  in_app_enabled?: boolean | null
  email_enabled?: boolean | null
  push_enabled?: boolean | null
  whatsapp_enabled?: boolean | null
}

async function fetchChannelPrefs(input: {
  userId: string
  platform: string
  category: string
  sampleType: string
}): Promise<ChannelNotificationPrefs> {
  const { data, error } = await supabase.rpc('get_user_notification_preferences', {
    p_user_id: input.userId,
    p_platform: input.platform,
    p_category: input.category,
    p_notification_type: input.sampleType,
  })

  if (error || !data?.length) return DEFAULT_PREFS
  const row = data[0] as PrefRow
  return {
    inAppEnabled: row.in_app_enabled ?? true,
    emailEnabled: row.email_enabled ?? true,
    pushEnabled: row.push_enabled ?? true,
    whatsappEnabled: row.whatsapp_enabled ?? false,
  }
}

async function saveChannelPrefs(input: {
  userId: string
  platform: string
  category: string
  types: readonly string[]
  prefs: ChannelNotificationPrefs
}): Promise<{ error: string | null }> {
  const rows = input.types.map((notification_type) => ({
    user_id: input.userId,
    platform: input.platform,
    category: input.category,
    notification_type,
    in_app_enabled: input.prefs.inAppEnabled,
    email_enabled: input.prefs.emailEnabled,
    push_enabled: input.prefs.pushEnabled,
    whatsapp_enabled: input.prefs.whatsappEnabled,
    sms_enabled: false,
    frequency: 'immediate',
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase.from('notification_preferences').upsert(rows, {
    onConflict: 'user_id,platform,category,notification_type',
  })

  return { error: error?.message ?? null }
}

const SHOP_TYPES = [
  'new_order_vendor',
  'cod_order_vendor',
  'payment_received_vendor',
  'low_stock_alert_vendor',
  'listing_inquiry_seller',
  'order_confirmation_reminder_vendor',
] as const

const CHAT_TYPES = ['message_received'] as const

const CLASS_TYPES = [
  'class_enrollment_confirmed',
  'class_lesson_published',
  'class_starting_soon',
] as const

const COWORK_TYPES = [
  'meeting_invitation',
  'meeting_reminder_30min',
  'meeting_reminder_5min',
  'meeting_started',
  'meeting_cancelled',
  'meeting_rescheduled',
  'meeting_recording_available',
  'meeting_access_request',
  'meeting_chat_message',
] as const

/** Seller / Manage Shop alert channel preferences. */
export async function fetchShopNotificationPrefs(userId: string) {
  return fetchChannelPrefs({
    userId,
    platform: 'marketplace',
    category: 'transactional',
    sampleType: 'new_order_vendor',
  })
}

export async function saveShopNotificationPrefs(
  userId: string,
  prefs: ChannelNotificationPrefs,
) {
  return saveChannelPrefs({
    userId,
    platform: 'marketplace',
    category: 'transactional',
    types: SHOP_TYPES,
    prefs,
  })
}

/** Chat message alert preferences. */
export async function fetchChatNotificationPrefs(userId: string) {
  return fetchChannelPrefs({
    userId,
    platform: 'chat',
    category: 'messages',
    sampleType: 'message_received',
  })
}

export async function saveChatNotificationPrefs(
  userId: string,
  prefs: ChannelNotificationPrefs,
) {
  return saveChannelPrefs({
    userId,
    platform: 'chat',
    category: 'messages',
    types: CHAT_TYPES,
    prefs,
  })
}

/** Class course alert preferences. */
export async function fetchClassNotificationPrefs(userId: string) {
  return fetchChannelPrefs({
    userId,
    platform: 'class',
    category: 'transactional',
    sampleType: 'class_enrollment_confirmed',
  })
}

export async function saveClassNotificationPrefs(
  userId: string,
  prefs: ChannelNotificationPrefs,
) {
  return saveChannelPrefs({
    userId,
    platform: 'class',
    category: 'transactional',
    types: CLASS_TYPES,
    prefs,
  })
}

/** Co-Work meeting alert preferences. */
export async function fetchCoworkNotificationPrefs(userId: string) {
  return fetchChannelPrefs({
    userId,
    platform: 'community',
    category: 'transactional',
    sampleType: 'meeting_invitation',
  })
}

export async function saveCoworkNotificationPrefs(
  userId: string,
  prefs: ChannelNotificationPrefs,
) {
  return saveChannelPrefs({
    userId,
    platform: 'community',
    category: 'transactional',
    types: COWORK_TYPES,
    prefs,
  })
}

export { DEFAULT_PREFS as DEFAULT_CHANNEL_NOTIFICATION_PREFS }
