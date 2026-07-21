import { supabase } from '~/lib/supabase/client'

export type CommunityNotificationPrefs = {
  inAppEnabled: boolean
  emailEnabled: boolean
  pushEnabled: boolean
  whatsappEnabled: boolean
  /** Weekly / network digests over email */
  digestEmailEnabled: boolean
  /** Mention alerts (posts/comments) */
  mentionsEnabled: boolean
}

const DEFAULT_PREFS: CommunityNotificationPrefs = {
  inAppEnabled: true,
  emailEnabled: true,
  pushEnabled: true,
  whatsappEnabled: false,
  digestEmailEnabled: true,
  mentionsEnabled: true,
}

const DIGEST_TYPES = ['community_weekly_digest', 'network_suggestions_digest'] as const
const MENTION_TYPES = ['post_mentioned', 'comment_mentioned'] as const

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

  const [{ data: digestRow }, { data: mentionRow }] = await Promise.all([
    supabase.rpc('get_user_notification_preferences', {
      p_user_id: userId,
      p_platform: 'community',
      p_category: 'social',
      p_notification_type: 'community_weekly_digest',
    }),
    supabase.rpc('get_user_notification_preferences', {
      p_user_id: userId,
      p_platform: 'community',
      p_category: 'social',
      p_notification_type: 'post_mentioned',
    }),
  ])

  if (error || !data?.length) {
    return {
      ...DEFAULT_PREFS,
      digestEmailEnabled: digestRow?.[0]?.email_enabled ?? true,
      mentionsEnabled:
        (mentionRow?.[0]?.in_app_enabled ?? true) || (mentionRow?.[0]?.email_enabled ?? true),
    }
  }
  const row = data[0]
  return {
    inAppEnabled: row.in_app_enabled ?? true,
    emailEnabled: row.email_enabled ?? true,
    pushEnabled: row.push_enabled ?? true,
    whatsappEnabled: row.whatsapp_enabled ?? false,
    digestEmailEnabled: digestRow?.[0]?.email_enabled ?? true,
    mentionsEnabled:
      (mentionRow?.[0]?.in_app_enabled ?? true) || (mentionRow?.[0]?.email_enabled ?? true),
  }
}

/** Persist community social prefs across core notification types. */
export async function saveCommunityNotificationPrefs(
  userId: string,
  prefs: CommunityNotificationPrefs,
): Promise<{ error: string | null }> {
  const now = new Date().toISOString()
  const rows = COMMUNITY_TYPES.map((notification_type) => {
    const isDigest = (DIGEST_TYPES as readonly string[]).includes(notification_type)
    const isMention = (MENTION_TYPES as readonly string[]).includes(notification_type)
    return {
      user_id: userId,
      platform: 'community',
      category: 'social',
      notification_type,
      in_app_enabled: isMention ? prefs.mentionsEnabled && prefs.inAppEnabled : prefs.inAppEnabled,
      email_enabled: isDigest
        ? prefs.digestEmailEnabled && prefs.emailEnabled
        : isMention
          ? prefs.mentionsEnabled && prefs.emailEnabled
          : prefs.emailEnabled,
      push_enabled: isMention ? prefs.mentionsEnabled && prefs.pushEnabled : prefs.pushEnabled,
      whatsapp_enabled: prefs.whatsappEnabled,
      sms_enabled: false,
      frequency: isDigest ? 'weekly' : 'immediate',
      updated_at: now,
    }
  })

  const { error } = await supabase.from('notification_preferences').upsert(rows, {
    onConflict: 'user_id,platform,category,notification_type',
  })

  return { error: error?.message ?? null }
}
