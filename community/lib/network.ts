import { isUuid } from '~/commerce/lib/seo-urls'
import { INVALIDATION_TOPICS, invalidateCache } from '~/lib/cache/invalidation'
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
  date_of_birth?: string | null
  marriage_anniversary?: string | null
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

  if (data) {
    return { data: data as PublicProfile, error: null }
  }

  if (!isUuid(normalized)) {
    // Case-insensitive exact username match (wildcard-free ilike).
    const { data: byUsername } = await supabase
      .from('profiles')
      .select(PUBLIC_PROFILE_SELECT)
      .eq('is_deleted', false)
      .ilike('username', normalized)
      .limit(1)
      .maybeSingle()
    if (byUsername) {
      return { data: byUsername as PublicProfile, error: null }
    }

    // Renamed accounts: old links (notifications, emails, shares) embed the
    // username from send time. username_history maps it to the profile.
    const { data: historyRow } = await supabase
      .from('username_history')
      .select('profile_id')
      .ilike('username', normalized)
      .order('changed_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (historyRow?.profile_id) {
      const { data: byHistory } = await supabase
        .from('profiles')
        .select(PUBLIC_PROFILE_SELECT)
        .eq('is_deleted', false)
        .eq('id', historyRow.profile_id)
        .maybeSingle()
      if (byHistory) {
        return { data: byHistory as PublicProfile, error: null }
      }
    }

    // Fallback for legacy mentions stored as a display name (e.g.
    // "@Archena_S_Agarwal"). Try resolving by full_name with underscores
    // treated as spaces.
    const nameGuess = normalized.replace(/_+/g, ' ').trim()
    if (nameGuess) {
      const { data: byName } = await supabase
        .from('profiles')
        .select(PUBLIC_PROFILE_SELECT)
        .eq('is_deleted', false)
        .ilike('full_name', nameGuess)
        .order('connections_count', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle()

      if (byName) {
        return { data: byName as PublicProfile, error: null }
      }
    }
  }

  return { data: null, error: 'Profile not found' }
}

export type ProfileSuggestion = {
  id: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
  headline: string | null
}

export type HashtagSuggestion = {
  tag: string
  usage_count?: number
}

export const MENTION_SUGGEST_PAGE_SIZE = 20
export const HASHTAG_SUGGEST_PAGE_SIZE = 25

/** Escape characters that would break a PostgREST `or(...)` filter value. */
function sanitizeFilterValue(value: string): string {
  return value.replace(/[,()\\%]/g, ' ').trim()
}

/**
 * Search public profiles by name or username for the mention autocomplete.
 * With an empty query it returns well-connected profiles as default suggestions.
 */
export async function searchProfiles(
  query: string,
  limit = MENTION_SUGGEST_PAGE_SIZE,
  offset = 0,
): Promise<ProfileSuggestion[]> {
  const trimmed = query.trim()
  const safeLimit = Math.max(1, Math.min(limit, 50))
  const from = Math.max(0, offset)
  const to = from + safeLimit - 1

  let request = supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url, headline')
    .eq('is_deleted', false)
    .range(from, to)

  const safe = sanitizeFilterValue(trimmed)
  if (safe) {
    request = request.or(`full_name.ilike.%${safe}%,username.ilike.%${safe}%`)
  } else {
    request = request.order('connections_count', { ascending: false, nullsFirst: false })
  }

  const { data, error } = await request
  if (error || !data) return []
  return data as ProfileSuggestion[]
}

export type ProfileIntentMatch = ProfileSuggestion & {
  occupation: string | null
  industry: string | null
  business_name: string | null
  bio: string | null
  follower_count: number | null
  location: string | null
  gender: boolean | null
}

const PROFILE_INTENT_SELECT =
  'id, full_name, username, avatar_url, headline, occupation, industry, business_name, bio, follower_count, location, gender'

const CITY_SKIP = new Set(['india', 'near', 'city', 'town', 'area', 'the', 'and', 'me'])

function profileIsWoman(row: ProfileIntentMatch): boolean {
  if (row.gender === true) return true
  const role = [row.occupation, row.headline, row.business_name].filter(Boolean).join(' ')
  return /\b(women|woman)\b/i.test(role)
}

function profileNearMember(row: ProfileIntentMatch, memberLocation: string): boolean {
  const cities = memberLocation
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !CITY_SKIP.has(token))
  const loc = (row.location ?? '').toLowerCase()
  if (!loc || !cities.length) return false
  return cities.some((city) => loc.includes(city))
}

/**
 * Match public profiles on occupation, headline, and bio.
 * Used when the sentence is about people, not a product name.
 */
export async function searchProfilesForIntent(
  tokens: string[],
  limit = 12,
  preferWomen = false,
  memberLocation = '',
): Promise<ProfileIntentMatch[]> {
  const unique = [...new Set(tokens.map((token) => sanitizeFilterValue(token)).filter((token) => token.length >= 4))]
  if (!unique.length) {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_INTENT_SELECT)
      .eq('is_deleted', false)
      .order('follower_count', { ascending: false, nullsFirst: false })
      .limit(limit)
    if (error || !data) return []
    return data as ProfileIntentMatch[]
  }

  const fields = ['occupation', 'headline', 'bio', 'industry', 'business_name', 'full_name']
  const or = unique
    .flatMap((token) => fields.map((field) => `${field}.ilike.%${token}%`))
    .join(',')
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_INTENT_SELECT)
    .eq('is_deleted', false)
    .or(or)
    .limit(80)
  if (error || !data) return []

  let rows = data as ProfileIntentMatch[]
  if (preferWomen && rows.some(profileIsWoman)) {
    rows = rows.filter(profileIsWoman)
  }
  const city = memberLocation.trim()
  const ranked = rows.map((row) => {
    const haystack = [row.occupation, row.headline, row.bio, row.industry, row.business_name, row.full_name]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return {
      row,
      role: unique.some((token) => haystack.includes(token)) ? 1 : 0,
      place: city && profileNearMember(row, city) ? 1 : 0,
      followers: row.follower_count ?? 0,
    }
  })
  ranked.sort((a, b) => b.role - a.role || b.place - a.place || b.followers - a.followers)
  return ranked.slice(0, limit).map((item) => item.row)
}

/** Load public profiles in the same order as the requested ids. */
export async function fetchProfilesByIds(ids: string[]): Promise<PublicProfile[]> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))].slice(0, 24)
  if (!unique.length) return []
  const { data, error } = await supabase
    .from('profiles')
    .select(PUBLIC_PROFILE_SELECT)
    .in('id', unique)
    .eq('is_deleted', false)
  if (error || !data) return []
  const byId = new Map((data as PublicProfile[]).map((row) => [row.id, row]))
  return unique.map((id) => byId.get(id)).filter((row): row is PublicProfile => !!row)
}

/** Suggest hashtags for the composer autocomplete, ordered by usage. */
export async function suggestHashtags(
  query: string,
  limit = HASHTAG_SUGGEST_PAGE_SIZE,
): Promise<HashtagSuggestion[]> {
  const prefix = query.trim().replace(/^#/, '')
  const maxResults = Math.max(1, Math.min(limit, 50))
  const { data, error } = await supabase.rpc('get_hashtag_suggestions', {
    prefix,
    max_results: maxResults,
  })
  if (error || !data) return []
  return (data as { tag: string; usage_count?: number }[])
    .map((row) => ({
      tag: row.tag,
      usage_count: row.usage_count ?? undefined,
    }))
    .filter((row) => Boolean(row.tag))
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
  page = 0,
): Promise<{ items: NetworkMember[]; hasMore: boolean; error: string | null }> {
  const from = page * limit
  const to = from + limit - 1

  let query = supabase
    .from('profiles')
    .select(
      'id, full_name, username, headline, avatar_url, location, industry, is_verified, connections_count',
      { count: 'exact' },
    )
    .eq('is_deleted', false)
    .not('full_name', 'is', null)
    .order('connections_count', { ascending: false, nullsFirst: false })
    .range(from, to)

  if (excludeUserId) {
    query = query.neq('id', excludeUserId)
  }

  const { data, error, count } = await query

  if (error) {
    return { items: [], hasMore: false, error: error.message }
  }

  const items = ((data ?? []) as ProfileRow[]).map(mapProfileRow)
  const total = count ?? 0

  return {
    items,
    hasMore: total ? to + 1 < total : items.length === limit,
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
    // Raw profile discovery knows nothing about the viewer's network, so drop
    // anyone already connected or mid-request before showing them as new.
    const related = new Set([
      ...((acceptedResult.data ?? []) as ConnectionRpcRow[]).map((row) => row.user_id),
      ...pendingRows.map((row) => row.user_id),
    ])
    const fallback = await fetchDiscoverMembers(userId, 16)
    if (!fallback.error) {
      suggestions = fallback.items.filter((member) => !related.has(member.user_id)).slice(0, 8)
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

  if (error) return { connectionId: null, error: error.message ?? null }
  invalidateCache(INVALIDATION_TOPICS.communityNetwork)
  return { connectionId: data?.id ?? null, error: null }
}

export async function respondToConnection(connectionId: string, status: 'accepted' | 'rejected') {
  const { error } = await supabase
    .from('connections')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', connectionId)

  if (!error) invalidateCache(INVALIDATION_TOPICS.communityNetwork)
  return { error: error?.message ?? null }
}

/**
 * Delete a connection row. Used both to remove an accepted connection
 * (disconnect) and to withdraw a still-pending outgoing request.
 */
export async function removeConnection(connectionId: string) {
  const { error } = await supabase.from('connections').delete().eq('id', connectionId)
  if (!error) invalidateCache(INVALIDATION_TOPICS.communityNetwork)
  return { error: error?.message ?? null }
}
