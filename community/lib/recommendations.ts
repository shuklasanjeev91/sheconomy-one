import { supabase } from '~/lib/supabase/client'
import { notifyFromTemplate } from '~/lib/notifications/notify'

export type ProfileRecommendation = {
  id: string
  recommendationText: string
  status: string
  createdAt: string
  recommenderId: string
  recommenderName: string
  recommenderHeadline: string | null
  recommenderAvatar: string | null
  recommenderUsername: string | null
}

export type RecommendationRequest = {
  id: string
  message: string | null
  status: string
  createdAt: string
  requesterId: string
  requesterName: string
  requesterAvatar: string | null
  requesterUsername: string | null
}

/** Published recommendations shown on a member's profile. */
export async function fetchProfileRecommendations(
  userId: string,
): Promise<{ items: ProfileRecommendation[]; error: string | null }> {
  const { data, error } = await supabase
    .from('recommendations')
    .select(
      `
      id,
      recommendation_text,
      status,
      created_at,
      recommender_id,
      profiles!recommendations_recommender_id_fkey (
        full_name,
        username,
        avatar_url,
        headline
      )
    `,
    )
    .eq('recommended_user_id', userId)
    .in('status', ['published', 'approved'])
    .order('created_at', { ascending: false })

  if (error) {
    // Fallback without embed if FK alias differs
    const fallback = await supabase
      .from('recommendations')
      .select('id, recommendation_text, status, created_at, recommender_id')
      .eq('recommended_user_id', userId)
      .in('status', ['published', 'approved'])
      .order('created_at', { ascending: false })

    if (fallback.error) return { items: [], error: fallback.error.message }

    const recommenderIds = [...new Set((fallback.data ?? []).map((r) => r.recommender_id))]
    const { data: profiles } = recommenderIds.length
      ? await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url, headline')
          .in('id', recommenderIds)
      : { data: [] as Array<{
          id: string
          full_name: string | null
          username: string | null
          avatar_url: string | null
          headline: string | null
        }> }

    const byId = new Map((profiles ?? []).map((p) => [p.id, p]))
    return {
      items: (fallback.data ?? []).map((row) => {
        const profile = byId.get(row.recommender_id)
        return {
          id: row.id,
          recommendationText: row.recommendation_text,
      status: row.status ?? 'approved',
      createdAt: row.created_at ?? new Date().toISOString(),
      recommenderId: row.recommender_id,
      recommenderName: profile?.full_name || profile?.username || 'Member',
      recommenderHeadline: profile?.headline ?? null,
      recommenderAvatar: profile?.avatar_url ?? null,
      recommenderUsername: profile?.username ?? null,
        }
      }),
      error: null,
    }
  }

  const items: ProfileRecommendation[] = (data ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    return {
      id: row.id,
      recommendationText: row.recommendation_text,
      status: row.status ?? 'approved',
      createdAt: row.created_at ?? new Date().toISOString(),
      recommenderId: row.recommender_id,
      recommenderName: profile?.full_name || profile?.username || 'Member',
      recommenderHeadline: profile?.headline ?? null,
      recommenderAvatar: profile?.avatar_url ?? null,
      recommenderUsername: profile?.username ?? null,
    }
  })

  return { items, error: null }
}

/** Pending recommendation requests for the signed-in member (people asking them to write). */
export async function fetchIncomingRecommendationRequests(
  userId: string,
): Promise<{ items: RecommendationRequest[]; error: string | null }> {
  const { data, error } = await supabase
    .from('recommendation_requests')
    .select('id, message, status, created_at, requester_id')
    .eq('requested_from_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) return { items: [], error: error.message }

  const requesterIds = [...new Set((data ?? []).map((r) => r.requester_id))]
  const { data: profiles } = requesterIds.length
    ? await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .in('id', requesterIds)
    : { data: [] as Array<{
        id: string
        full_name: string | null
        username: string | null
        avatar_url: string | null
      }> }

  const byId = new Map((profiles ?? []).map((p) => [p.id, p]))

  return {
    items: (data ?? []).map((row) => {
      const profile = byId.get(row.requester_id)
      return {
        id: row.id,
        message: row.message,
        status: row.status ?? 'pending',
        createdAt: row.created_at ?? new Date().toISOString(),
        requesterId: row.requester_id,
        requesterName: profile?.full_name || profile?.username || 'Member',
        requesterAvatar: profile?.avatar_url ?? null,
        requesterUsername: profile?.username ?? null,
      }
    }),
    error: null,
  }
}

/** Ask a connection to write a recommendation for you. */
export async function requestRecommendation(options: {
  requesterId: string
  requestedFromId: string
  message?: string
}): Promise<{ error: string | null }> {
  if (options.requesterId === options.requestedFromId) {
    return { error: 'You cannot request a recommendation from yourself.' }
  }

  const { data, error } = await supabase
    .from('recommendation_requests')
    .insert({
      requester_id: options.requesterId,
      requested_from_id: options.requestedFromId,
      message: options.message?.trim() || null,
      status: 'pending',
    })
    .select('id')
    .maybeSingle()

  if (error) return { error: error.message }

  const { data: requester } = await supabase
    .from('profiles')
    .select('full_name, username')
    .eq('id', options.requesterId)
    .maybeSingle()

  void notifyFromTemplate({
    templateKey: 'recommendation_requested',
    recipientId: options.requestedFromId,
    contextType: 'recommendation_request',
    contextId: data?.id,
    variables: {
      requester_name: requester?.full_name || requester?.username || 'Someone',
      message: options.message?.trim() || '',
      action_url: `/profile/${requester?.username || options.requesterId}`,
    },
    channels: ['in_app', 'email', 'push'],
  })

  return { error: null }
}

/** Write / publish a recommendation for another member. */
export async function writeRecommendation(options: {
  recommenderId: string
  recommendedUserId: string
  text: string
  requestId?: string | null
}): Promise<{ error: string | null }> {
  const text = options.text.trim()
  if (text.length < 20) {
    return { error: 'Write at least a short paragraph (20+ characters).' }
  }
  if (options.recommenderId === options.recommendedUserId) {
    return { error: 'You cannot recommend yourself.' }
  }

  const { data, error } = await supabase
    .from('recommendations')
    .insert({
      recommender_id: options.recommenderId,
      recommended_user_id: options.recommendedUserId,
      recommendation_text: text,
      status: 'approved',
    })
    .select('id')
    .maybeSingle()

  if (error) return { error: error.message }

  if (options.requestId) {
    await supabase
      .from('recommendation_requests')
      .update({ status: 'fulfilled', updated_at: new Date().toISOString() })
      .eq('id', options.requestId)
      .eq('requested_from_id', options.recommenderId)
  }

  const [{ data: recommender }, { data: recommended }] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, username')
      .eq('id', options.recommenderId)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('username')
      .eq('id', options.recommendedUserId)
      .maybeSingle(),
  ])

  void notifyFromTemplate({
    templateKey: 'recommendation_received',
    recipientId: options.recommendedUserId,
    contextType: 'recommendation',
    contextId: data?.id,
    variables: {
      recommender_name: recommender?.full_name || recommender?.username || 'Someone',
      recommendation_preview: text.slice(0, 120),
      action_url: `/profile/${recommended?.username || options.recommendedUserId}`,
    },
    channels: ['in_app', 'email', 'push', 'whatsapp'],
  })

  return { error: null }
}

export async function hideRecommendation(
  recommendationId: string,
  ownerUserId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('recommendations')
    .update({ status: 'hidden', updated_at: new Date().toISOString() })
    .eq('id', recommendationId)
    .eq('recommended_user_id', ownerUserId)

  return { error: error?.message ?? null }
}
