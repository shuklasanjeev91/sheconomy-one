import { supabase } from '~/lib/supabase/client'

export type ProfileAnalytics = {
  profileViewsCount: number
  profileViewsLast30Days: number
  uniqueViewersCount: number
  totalEngagement: number
}

export type ProfileViewer = {
  viewerId: string
  fullName: string
  username: string | null
  headline: string | null
  avatarUrl: string | null
  viewedAt: string
}

/** Record a professional profile view (skips self). */
export async function trackProfileView(options: {
  profileUserId: string
  viewerUserId?: string | null
}): Promise<void> {
  if (!options.profileUserId) return
  if (options.viewerUserId && options.viewerUserId === options.profileUserId) return

  try {
    const { error } = await supabase.rpc('track_profile_view', {
      p_profile_user_id: options.profileUserId,
      p_viewer_user_id: options.viewerUserId ?? undefined,
    })
    if (error) {
      await supabase.from('profile_views').insert({
        profile_user_id: options.profileUserId,
        viewer_user_id: options.viewerUserId ?? null,
      })
    }
  } catch {
    // Analytics only
  }
}

export async function fetchProfileAnalytics(
  userId: string,
  days = 30,
): Promise<ProfileAnalytics | null> {
  const { data, error } = await supabase.rpc('get_profile_analytics', {
    p_user_id: userId,
    p_days: days,
  })
  if (error || !data?.length) return null
  const row = data[0]
  return {
    profileViewsCount: row.profile_views_count ?? 0,
    profileViewsLast30Days: row.profile_views_last_30_days ?? 0,
    uniqueViewersCount: row.unique_viewers_count ?? 0,
    totalEngagement: row.total_engagement ?? 0,
  }
}

/** Recent people who viewed your profile (owner-only; anonymous views omitted). */
export async function fetchRecentProfileViewers(
  profileUserId: string,
  limit = 25,
): Promise<{ items: ProfileViewer[]; error: string | null }> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('profile_views')
    .select('viewer_user_id, viewed_at')
    .eq('profile_user_id', profileUserId)
    .not('viewer_user_id', 'is', null)
    .gte('viewed_at', since)
    .order('viewed_at', { ascending: false })
    .limit(limit * 3)

  if (error) return { items: [], error: error.message }

  const seen = new Set<string>()
  const unique: Array<{ viewerId: string; viewedAt: string }> = []
  for (const row of data ?? []) {
    const id = row.viewer_user_id
    if (!id || seen.has(id) || id === profileUserId) continue
    seen.add(id)
    unique.push({ viewerId: id, viewedAt: row.viewed_at })
    if (unique.length >= limit) break
  }

  if (!unique.length) return { items: [], error: null }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, username, headline, avatar_url')
    .in(
      'id',
      unique.map((row) => row.viewerId),
    )

  const byId = new Map((profiles ?? []).map((p) => [p.id, p]))

  return {
    items: unique.map((row) => {
      const profile = byId.get(row.viewerId)
      return {
        viewerId: row.viewerId,
        fullName: profile?.full_name || profile?.username || 'Member',
        username: profile?.username ?? null,
        headline: profile?.headline ?? null,
        avatarUrl: profile?.avatar_url ?? null,
        viewedAt: row.viewedAt,
      }
    }),
    error: null,
  }
}
