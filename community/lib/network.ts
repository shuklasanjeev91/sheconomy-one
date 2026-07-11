import { isUuid } from '~/commerce/lib/seo-urls'
import { supabase } from '~/lib/supabase/client'

export const NETWORK_PAGE_SIZE = 12

export type ProfileConnectionStatus =
  | 'self'
  | 'none'
  | 'pending_sent'
  | 'pending_received'
  | 'connected'

export type ProfileConnectionState = {
  status: ProfileConnectionStatus
  connectionId: string | null
  isSender: boolean
}

export type PublicProfile = {
  id: string
  full_name: string | null
  username: string
  avatar_url: string | null
  cover_url: string | null
  headline: string | null
  bio: string | null
  location: string | null
  industry: string | null
  occupation: string | null
  business_name: string | null
  is_verified: boolean
  follower_count: number | null
  following_count: number | null
  connections_count: number | null
  website_url: string | null
  portfolio_url: string | null
  instagram_url: string | null
  twitter_url: string | null
  youtube_url: string | null
  github_url: string | null
  interests: string[] | null
  profile_completion_percentage: number | null
}

const PUBLIC_PROFILE_SELECT =
  'id, full_name, username, avatar_url, cover_url, headline, bio, location, industry, occupation, business_name, is_verified, follower_count, following_count, connections_count, website_url, portfolio_url, instagram_url, twitter_url, youtube_url, github_url, interests, profile_completion_percentage'

export type NetworkMember = {
  user_id: string
  username: string | null
  full_name: string
  headline: string | null
  avatar_url: string | null
  location: string | null
  industry: string | null
  is_verified: boolean
  mutual_count: number
  connection_id: string | null
  connection_status: string | null
  is_sender: boolean
}

export type NetworkSummary = {
  connections: NetworkMember[]
  pendingReceived: NetworkMember[]
  pendingSent: NetworkMember[]
  suggestions: NetworkMember[]
  error: string | null
}

type ConnectionRpcRow = {
  user_id: string
  full_name: string
  headline: string | null
  avatar_url: string | null
  connection_id: string
  created_at: string
  status: string
  is_sender: boolean
  mutual_count: number
}

type SuggestionRpcRow = {
  user_id: string
  full_name: string
  headline: string | null
  avatar_url: string | null
  mutual_count: number
}

type ProfileRow = {
  id: string
  full_name: string | null
  username: string
  headline: string | null
  avatar_url: string | null
  location: string | null
  industry: string | null
  is_verified: boolean
  connections_count: number | null
}

function mapConnectionRow(row: ConnectionRpcRow): NetworkMember {
  return {
    user_id: row.user_id,
    username: null,
    full_name: row.full_name,
    headline: row.headline,
    avatar_url: row.avatar_url,
    location: null,
    industry: null,
    is_verified: false,
    mutual_count: row.mutual_count ?? 0,
    connection_id: row.connection_id,
    connection_status: row.status,
    is_sender: row.is_sender,
  }
}

function mapSuggestionRow(row: SuggestionRpcRow): NetworkMember {
  return {
    user_id: row.user_id,
    username: null,
    full_name: row.full_name,
    headline: row.headline,
    avatar_url: row.avatar_url,
    location: null,
    industry: null,
    is_verified: false,
    mutual_count: row.mutual_count ?? 0,
    connection_id: null,
    connection_status: null,
    is_sender: false,
  }
}

function mapProfileRow(row: ProfileRow): NetworkMember {
  return {
    user_id: row.id,
    username: row.username,
    full_name: row.full_name ?? row.username,
    headline: row.headline,
    avatar_url: row.avatar_url,
    location: row.location,
    industry: row.industry,
    is_verified: row.is_verified,
    mutual_count: 0,
    connection_id: null,
    connection_status: null,
    is_sender: false,
  }
}

export async function fetchPublicProfile(
  handle: string,
): Promise<{ data: PublicProfile | null; error: string | null }> {
  const normalized = decodeURIComponent(handle).replace(/^@/, '').trim()
  if (!normalized) {
    return { data: null, error: 'Profile not found' }
  }

  let query = supabase
    .from('profiles')
    .select(PUBLIC_PROFILE_SELECT)
    .eq('is_deleted', false)

  query = isUuid(normalized)
    ? query.eq('id', normalized)
    : query.eq('username', normalized)

  const { data, error } = await query.maybeSingle()

  if (error) {
    return { data: null, error: error.message }
  }

  return { data: (data as PublicProfile | null) ?? null, error: data ? null : 'Profile not found' }
}

type ConnectionStatusRow = {
  connection_id?: string
  id?: string
  sender_id: string
  receiver_id: string
  status: string | null
}

export async function fetchConnectionState(
  viewerId: string | null | undefined,
  targetUserId: string | null | undefined,
): Promise<ProfileConnectionState> {
  const empty: ProfileConnectionState = {
    status: 'none',
    connectionId: null,
    isSender: false,
  }

  if (!targetUserId) return empty
  if (!viewerId) return empty
  if (viewerId === targetUserId) {
    return { status: 'self', connectionId: null, isSender: false }
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc('get_connection_status', {
    user1_id: viewerId,
    user2_id: targetUserId,
  })

  let row = (rpcData?.[0] as ConnectionStatusRow | undefined) ?? null

  if (rpcError || !row) {
    const { data: direct } = await supabase
      .from('connections')
      .select('id, sender_id, receiver_id, status')
      .or(
        `and(sender_id.eq.${viewerId},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${viewerId})`,
      )
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    row = direct
      ? {
          id: direct.id,
          sender_id: direct.sender_id,
          receiver_id: direct.receiver_id,
          status: direct.status,
        }
      : null
  }

  if (!row?.status || row.status === 'rejected') return empty

  const connectionId = row.connection_id ?? row.id ?? null
  const isSender = row.sender_id === viewerId

  if (row.status === 'accepted') {
    return { status: 'connected', connectionId, isSender }
  }

  if (row.status === 'pending') {
    return {
      status: isSender ? 'pending_sent' : 'pending_received',
      connectionId,
      isSender,
    }
  }

  return empty
}

export async function fetchDiscoverMembers(
  excludeUserId?: string,
  limit = NETWORK_PAGE_SIZE,
): Promise<{ items: NetworkMember[]; error: string | null }> {
  let query = supabase
    .from('profiles')
    .select(
      'id, full_name, username, headline, avatar_url, location, industry, is_verified, connections_count',
    )
    .eq('is_deleted', false)
    .not('full_name', 'is', null)
    .order('connections_count', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (excludeUserId) {
    query = query.neq('id', excludeUserId)
  }

  const { data, error } = await query

  if (error) {
    return { items: [], error: error.message }
  }

  return {
    items: ((data ?? []) as ProfileRow[]).map(mapProfileRow),
    error: null,
  }
}

export async function fetchNetworkSummary(userId: string): Promise<NetworkSummary> {
  const [acceptedResult, pendingResult, suggestionsResult] = await Promise.all([
    supabase.rpc('get_user_connections', {
      target_user_id: userId,
      connection_status: 'accepted',
    }),
    supabase.rpc('get_user_connections', {
      target_user_id: userId,
      connection_status: 'pending',
    }),
    supabase.rpc('get_connection_suggestions', {
      target_user_id: userId,
      limit_count: NETWORK_PAGE_SIZE,
    }),
  ])

  const rpcFailed =
    acceptedResult.error?.message?.includes('permission denied') ||
    pendingResult.error?.message?.includes('permission denied') ||
    suggestionsResult.error?.message?.includes('permission denied')

  if (rpcFailed) {
    const fallback = await fetchDiscoverMembers(userId)
    return {
      connections: [],
      pendingReceived: [],
      pendingSent: [],
      suggestions: fallback.items,
      error: fallback.error,
    }
  }

  const pendingRows = (pendingResult.data ?? []) as ConnectionRpcRow[]
  const pendingReceived = pendingRows
    .filter((row) => !row.is_sender)
    .map(mapConnectionRow)
  const pendingSent = pendingRows.filter((row) => row.is_sender).map(mapConnectionRow)

  let suggestions = ((suggestionsResult.data ?? []) as SuggestionRpcRow[]).map(mapSuggestionRow)

  if (suggestions.length === 0) {
    const fallback = await fetchDiscoverMembers(userId, 8)
    if (!fallback.error) {
      suggestions = fallback.items
    }
  }

  return {
    connections: ((acceptedResult.data ?? []) as ConnectionRpcRow[]).map(mapConnectionRow),
    pendingReceived,
    pendingSent,
    suggestions,
    error:
      acceptedResult.error?.message ??
      pendingResult.error?.message ??
      suggestionsResult.error?.message ??
      null,
  }
}

export async function sendConnectionRequest(senderId: string, receiverId: string) {
  const { data, error } = await supabase
    .from('connections')
    .insert({
      sender_id: senderId,
      receiver_id: receiverId,
      status: 'pending',
    })
    .select('id')
    .maybeSingle()

  return { connectionId: data?.id ?? null, error: error?.message ?? null }
}

export async function respondToConnection(connectionId: string, status: 'accepted' | 'rejected') {
  const { error } = await supabase
    .from('connections')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', connectionId)

  return { error: error?.message ?? null }
}
