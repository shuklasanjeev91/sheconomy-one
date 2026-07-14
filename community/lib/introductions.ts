import { supabase } from '~/lib/supabase/client'

export type MutualIntroducer = {
  user_id: string
  full_name: string
  username: string | null
  avatar_url: string | null
  headline: string | null
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

  const peerIds = [...viewerPeers]
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
