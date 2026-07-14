import { supabase } from '~/lib/supabase/client'

export type CommunityNotificationPrefs = {
  inAppEnabled: boolean
  emailEnabled: boolean
  pushEnabled: boolean
  whatsappEnabled: boolean
}

const DEFAULT_PREFS: CommunityNotificationPrefs = {
  inAppEnabled: true,
  emailEnabled: true,
  pushEnabled: true,
  whatsappEnabled: false,
}

const COMMUNITY_TYPES = [
  'connection_request',
  'connection_accepted',
  'new_follower',
  'post_mentioned',
  'comment_mentioned',
  'skill_endorsed',
  'recommendation_received',
  'recommendation_requested',
  'post_liked',
  'post_comment',
  'post_commented',
  'post_reposted',
  'post_reply',
  'hashtag_post',
  'connection_new_post',
  'follower_new_post',
  'celebration_posted',
  'introduction_requested',
  'network_invite_received',
  'community_weekly_digest',
  'group_invitation_received',
  'company_new_post',
  'group_new_post',
  'company_followed',
  'event_rsvp_received',
  'event_registration_received',
  'profile_viewed',
  'network_suggestions_digest',
  'article_published',
] as const

/** Load community social alert channel preferences. */
export async function fetchCommunityNotificationPrefs(
  userId: string,
): Promise<CommunityNotificationPrefs> {
  const { data, error } = await supabase.rpc('get_user_notification_preferences', {
    p_user_id: userId,
    p_platform: 'community',
    p_category: 'social',
    p_notification_type: 'connection_request',
  })

  if (error || !data?.length) return DEFAULT_PREFS
  const row = data[0]
  return {
    inAppEnabled: row.in_app_enabled ?? true,
    emailEnabled: row.email_enabled ?? true,
    pushEnabled: row.push_enabled ?? true,
    whatsappEnabled: row.whatsapp_enabled ?? false,
  }
}

/** Persist community social prefs across core notification types. */
export async function saveCommunityNotificationPrefs(
  userId: string,
  prefs: CommunityNotificationPrefs,
): Promise<{ error: string | null }> {
  const rows = COMMUNITY_TYPES.map((notification_type) => ({
    user_id: userId,
    platform: 'community',
    category: 'social',
    notification_type,
    in_app_enabled: prefs.inAppEnabled,
    email_enabled: prefs.emailEnabled,
    push_enabled: prefs.pushEnabled,
    whatsapp_enabled: prefs.whatsappEnabled,
    sms_enabled: false,
    frequency: 'immediate',
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase.from('notification_preferences').upsert(rows, {
    onConflict: 'user_id,platform,category,notification_type',
  })

  return { error: error?.message ?? null }
}
