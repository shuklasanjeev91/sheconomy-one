import { supabase } from '~/lib/supabase/client'

export type CommerceNotificationPrefs = {
  inAppEnabled: boolean
  emailEnabled: boolean
  pushEnabled: boolean
  smsEnabled: boolean
  whatsappEnabled: boolean
  frequency: string
}

const DEFAULT_PREFS: CommerceNotificationPrefs = {
  inAppEnabled: true,
  emailEnabled: true,
  pushEnabled: true,
  smsEnabled: false,
  whatsappEnabled: true,
  frequency: 'immediate',
}

const BUYER_PROMO_TYPES = [
  'cart_abandoned_customer',
  'product_back_in_stock',
  'wishlist_sale',
] as const

const BUYER_ORDER_TYPES = [
  'order_placed_customer',
  'order_confirmed_customer',
  'order_processing_customer',
  'order_shipped_customer',
  'order_item_shipped_customer',
  'order_out_for_delivery_customer',
  'order_delivered_customer',
  'order_cancelled_customer',
] as const

/** Load marketplace/promotional channel preferences for the signed-in user. */
export async function fetchCommerceNotificationPrefs(
  userId: string,
): Promise<CommerceNotificationPrefs> {
  const { data, error } = await supabase.rpc('get_user_notification_preferences', {
    p_user_id: userId,
    p_platform: 'marketplace',
    p_category: 'promotional',
    p_notification_type: 'cart_abandoned_customer',
  })

  if (error || !data?.length) return DEFAULT_PREFS

  const row = data[0]
  return {
    inAppEnabled: row.in_app_enabled ?? true,
    emailEnabled: row.email_enabled ?? true,
    pushEnabled: row.push_enabled ?? true,
    smsEnabled: row.sms_enabled ?? false,
    whatsappEnabled: row.whatsapp_enabled ?? false,
    frequency: row.frequency ?? 'immediate',
  }
}

/**
 * Persist marketplace buyer preferences for promotional + transactional order alerts.
 */
export async function saveCommerceNotificationPrefs(
  userId: string,
  prefs: CommerceNotificationPrefs,
): Promise<{ error: string | null }> {
  const now = new Date().toISOString()
  const promoRows = BUYER_PROMO_TYPES.map((notification_type) => ({
    user_id: userId,
    platform: 'marketplace',
    category: 'promotional',
    notification_type,
    in_app_enabled: prefs.inAppEnabled,
    email_enabled: prefs.emailEnabled,
    push_enabled: prefs.pushEnabled,
    sms_enabled: prefs.smsEnabled,
    whatsapp_enabled: prefs.whatsappEnabled,
    frequency: prefs.frequency || 'immediate',
    updated_at: now,
  }))

  const orderRows = BUYER_ORDER_TYPES.map((notification_type) => ({
    user_id: userId,
    platform: 'marketplace',
    category: 'transactional',
    notification_type,
    in_app_enabled: prefs.inAppEnabled,
    email_enabled: prefs.emailEnabled,
    push_enabled: prefs.pushEnabled,
    sms_enabled: prefs.smsEnabled,
    whatsapp_enabled: prefs.whatsappEnabled,
    frequency: prefs.frequency || 'immediate',
    updated_at: now,
  }))

  const { error } = await supabase
    .from('notification_preferences')
    .upsert([...promoRows, ...orderRows], {
      onConflict: 'user_id,platform,category,notification_type',
    })

  return { error: error?.message ?? null }
}
