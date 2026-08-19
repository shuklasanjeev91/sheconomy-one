import { communityRoutes } from '~/lib/routes'
import { supabase } from '~/lib/supabase/client'
import { INVALIDATION_TOPICS, invalidateCache } from '~/lib/cache/invalidation'

export type MutualIntroducer = {
  user_id: string
  full_name: string
  username: string | null
  avatar_url: string | null
  headline: string | null
}

export type IntroductionStatus = 'pending' | 'accepted' | 'declined' | 'cancelled'

export type IntroductionRequest = {
  id: string
  requester_id: string
  introducer_id: string
  target_id: string
  message: string | null
  status: IntroductionStatus
  created_at: string
  requester_name: string
  requester_avatar: string | null
  target_name: string
  target_avatar: string | null
}

/** List accepted connections of the viewer who are also connected to the target. */
export async function fetchMutualIntroducers(
  viewerId: string,
  targetId: string,
): Promise<MutualIntroducer[]> {
  const { data: viewerConnections } = await supabase
    .from('connections')
    .select('sender_id, receiver_id')
    .eq('status', 'accepted')
    .or(`sender_id.eq.${viewerId},receiver_id.eq.${viewerId}`)

  const viewerPeers = new Set<string>()
  for (const row of viewerConnections ?? []) {
    const peer = row.sender_id === viewerId ? row.receiver_id : row.sender_id
    if (peer && peer !== targetId) viewerPeers.add(peer)
  }

  if (!viewerPeers.size) return []

  const { data: targetConnections } = await supabase
    .from('connections')
    .select('sender_id, receiver_id')
    .eq('status', 'accepted')
    .or(`sender_id.eq.${targetId},receiver_id.eq.${targetId}`)

  const mutualIds: string[] = []
  for (const row of targetConnections ?? []) {
    const peer = row.sender_id === targetId ? row.receiver_id : row.sender_id
    if (peer && viewerPeers.has(peer)) mutualIds.push(peer)
  }

  if (!mutualIds.length) return []

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url, headline')
    .in('id', mutualIds.slice(0, 12))

  return (profiles ?? []).map((profile) => ({
    user_id: profile.id,
    full_name: profile.full_name || profile.username || 'Member',
    username: profile.username,
    avatar_url: profile.avatar_url,
    headline: profile.headline,
  }))
}

/** Ask a mutual connection to introduce you to the target. */
export async function requestIntroduction(
  introducerId: string,
  targetId: string,
  message?: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('request_introduction', {
    p_introducer_id: introducerId,
    p_target_id: targetId,
    p_message: message?.trim() || null,
  })
  return { error: error?.message ?? null }
}

/** Pending intros where the viewer is the introducer. */
export async function fetchIntroductionInbox(
  userId: string,
): Promise<{ items: IntroductionRequest[]; error: string | null }> {
  const { data, error } = await supabase
    .from('introduction_requests')
    .select('*')
    .eq('introducer_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(40)

  if (error) return { items: [], error: error.message }
  const rows = data ?? []
  if (!rows.length) return { items: [], error: null }

  const profileIds = [...new Set(rows.flatMap((row) => [row.requester_id, row.target_id]))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url')
    .in('id', profileIds)
  const byId = new Map((profiles ?? []).map((profile) => [profile.id, profile]))

  const items: IntroductionRequest[] = rows.map((row) => {
    const requester = byId.get(row.requester_id)
    const target = byId.get(row.target_id)
    return {
      id: row.id,
      requester_id: row.requester_id,
      introducer_id: row.introducer_id,
      target_id: row.target_id,
      message: row.message,
      status: row.status as IntroductionStatus,
      created_at: row.created_at,
      requester_name: requester?.full_name || requester?.username || 'Member',
      requester_avatar: requester?.avatar_url ?? null,
      target_name: target?.full_name || target?.username || 'Member',
      target_avatar: target?.avatar_url ?? null,
    }
  })

  return { items, error: null }
}

export type IntroductionSentRequest = {
  id: string
  introducer_id: string
  target_id: string
  message: string | null
  status: IntroductionStatus
  created_at: string
  introducer_name: string
  introducer_avatar: string | null
  target_name: string
  target_avatar: string | null
}

export type IntroductionSentRevisitCard = {
  id: string
  introducerName: string
  introducerAvatar: string | null
  targetName: string
  message: string | null
}

/** Pending intros the viewer requested from mutual connections. */
export async function fetchIntroductionSent(
  userId: string,
): Promise<{ items: IntroductionSentRequest[]; error: string | null }> {
  const { data, error } = await supabase
    .from('introduction_requests')
    .select('*')
    .eq('requester_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(40)

  if (error) return { items: [], error: error.message }
  const rows = data ?? []
  if (!rows.length) return { items: [], error: null }

  const profileIds = [...new Set(rows.flatMap((row) => [row.introducer_id, row.target_id]))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url')
    .in('id', profileIds)
  const byId = new Map((profiles ?? []).map((profile) => [profile.id, profile]))

  const items: IntroductionSentRequest[] = rows.map((row) => {
    const introducer = byId.get(row.introducer_id)
    const target = byId.get(row.target_id)
    return {
      id: row.id,
      introducer_id: row.introducer_id,
      target_id: row.target_id,
      message: row.message,
      status: row.status as IntroductionStatus,
      created_at: row.created_at,
      introducer_name: introducer?.full_name || introducer?.username || 'Member',
      introducer_avatar: introducer?.avatar_url ?? null,
      target_name: target?.full_name || target?.username || 'Member',
      target_avatar: target?.avatar_url ?? null,
    }
  })

  return { items, error: null }
}

export function buildIntroductionSentRevisitCards(
  items: IntroductionSentRequest[],
  limit = 4,
): IntroductionSentRevisitCard[] {
  return items.slice(0, limit).map((item) => ({
    id: item.id,
    introducerName: item.introducer_name,
    introducerAvatar: item.introducer_avatar,
    targetName: item.target_name,
    message: item.message,
  }))
}

export function introductionSentRevisitSeeAllHref() {
  return communityRoutes.network
}

export async function respondToIntroduction(
  requestId: string,
  status: 'accepted' | 'declined' | 'cancelled',
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('introduction_requests')
    .update({ status })
    .eq('id', requestId)
  if (!error) invalidateCache(INVALIDATION_TOPICS.communityNetwork)
  return { error: error?.message ?? null }
}
