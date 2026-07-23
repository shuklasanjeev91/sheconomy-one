import {
  fetchDiscoverMembers,
  fetchNetworkSummary,
  type NetworkMember,
} from '~/community/lib/network'
import { BRAND_NAME } from '~/config/brand'
import { supabase } from '~/lib/supabase/client'

export const USER_LIST_PAGE_SIZE = 20

export type UserListKind =
  | 'connections'
  | 'followers'
  | 'following'
  | 'pending-received'
  | 'pending-sent'
  | 'suggestions'
  | 'discover'

export type UserListMember = NetworkMember & {
  followed_at?: string | null
}

export type UserListPage = {
  items: UserListMember[]
  /** Total matching rows (authoritative for counters). */
  totalCount: number
  hasMore: boolean
  error: string | null
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

function mapProfile(row: ProfileRow, extra?: Partial<UserListMember>): UserListMember {
  return {
    user_id: row.id,
    username: row.username,
    full_name: row.full_name ?? row.username,
    headline: row.headline,
    avatar_url: row.avatar_url,
    location: row.location,
    industry: row.industry,
    is_verified: row.is_verified,
    mutual_count: extra?.mutual_count ?? 0,
    connection_id: extra?.connection_id ?? null,
    connection_status: extra?.connection_status ?? null,
    is_sender: extra?.is_sender ?? false,
    followed_at: extra?.followed_at ?? null,
  }
}

function dedupeMembers(items: UserListMember[]): UserListMember[] {
  const byId = new Map<string, UserListMember>()
  for (const item of items) {
    if (!item.user_id || byId.has(item.user_id)) continue
    byId.set(item.user_id, item)
  }
  return Array.from(byId.values())
}

async function fetchProfilesByIds(ids: string[]): Promise<UserListMember[]> {
  if (!ids.length) return []

  const uniqueIds = [...new Set(ids.filter(Boolean))]
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, username, headline, avatar_url, location, industry, is_verified')
    .in('id', uniqueIds)
    .eq('is_deleted', false)

  if (error || !data) return []

  const byId = new Map((data as ProfileRow[]).map((row) => [row.id, row]))
  return uniqueIds
    .map((id) => {
      const row = byId.get(id)
      return row ? mapProfile(row) : null
    })
    .filter((item): item is UserListMember => !!item)
}

/** Accepted connections — paginated (no hard cap; load via infinite scroll). */
export async function fetchAcceptedConnections(
  userId: string,
  page = 0,
  pageSize = USER_LIST_PAGE_SIZE,
): Promise<UserListPage> {
  const from = page * pageSize
  const to = from + pageSize - 1

  const { data: rows, error, count } = await supabase
    .from('connections')
    .select('id, sender_id, receiver_id, status, created_at', { count: 'exact' })
    .eq('status', 'accepted')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    return {
      items: [],
      totalCount: 0,
      hasMore: false,
      error: error.message ?? 'Could not load connections',
    }
  }

  const otherIds = (rows ?? []).map((row) =>
    row.sender_id === userId ? row.receiver_id : row.sender_id,
  )
  const profiles = await fetchProfilesByIds(otherIds)
  const byId = new Map(profiles.map((item) => [item.user_id, item]))
  const mapped: UserListMember[] = []
  for (let index = 0; index < otherIds.length; index += 1) {
    const id = otherIds[index]
    const profile = byId.get(id)
    if (!profile) continue
    const row = rows?.[index]
    mapped.push({
      ...profile,
      connection_id: row?.id ?? null,
      connection_status: 'accepted',
      is_sender: row?.sender_id === userId,
    })
  }
  const items = dedupeMembers(mapped)
  const totalCount = count ?? items.length

  return {
    items,
    totalCount,
    hasMore: totalCount ? to + 1 < totalCount : items.length === pageSize,
    error: null,
  }
}

export async function fetchUserFollowers(
  userId: string,
  page = 0,
  pageSize = USER_LIST_PAGE_SIZE,
): Promise<UserListPage> {
  const from = page * pageSize
  const to = from + pageSize - 1

  const { data, error, count } = await supabase
    .from('follows')
    .select('follower_id, created_at', { count: 'exact' })
    .eq('following_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    return { items: [], totalCount: 0, hasMore: false, error: error.message }
  }

  const ids = [...new Set((data ?? []).map((row) => row.follower_id).filter(Boolean))]
  const items = await fetchProfilesByIds(ids)
  const totalCount = count ?? items.length

  return {
    items,
    totalCount,
    hasMore: totalCount ? to + 1 < totalCount : false,
    error: null,
  }
}

export async function fetchUserFollowing(
  userId: string,
  page = 0,
  pageSize = USER_LIST_PAGE_SIZE,
): Promise<UserListPage> {
  const from = page * pageSize
  const to = from + pageSize - 1

  const { data, error, count } = await supabase
    .from('follows')
    .select('following_id, created_at', { count: 'exact' })
    .eq('follower_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    return { items: [], totalCount: 0, hasMore: false, error: error.message }
  }

  const ids = [...new Set((data ?? []).map((row) => row.following_id).filter(Boolean))]
  const items = await fetchProfilesByIds(ids)
  const totalCount = count ?? items.length

  return {
    items,
    totalCount,
    hasMore: totalCount ? to + 1 < totalCount : false,
    error: null,
  }
}

/** Exact counts for profile counters (same sources as the list sheets). */
export async function fetchProfileNetworkCounts(userId: string): Promise<{
  connections: number
  followers: number
  following: number
}> {
  const [connections, followers, following] = await Promise.all([
    fetchAcceptedConnections(userId),
    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId)
      .eq('status', 'active'),
    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId)
      .eq('status', 'active'),
  ])

  return {
    connections: connections.totalCount,
    followers: followers.count ?? 0,
    following: following.count ?? 0,
  }
}

export async function fetchUserListByKind(
  kind: UserListKind,
  userId: string,
  page = 0,
): Promise<UserListPage> {
  if (kind === 'followers') {
    return fetchUserFollowers(userId, page)
  }

  if (kind === 'following') {
    return fetchUserFollowing(userId, page)
  }

  if (kind === 'connections') {
    return fetchAcceptedConnections(userId, page)
  }

  if (kind === 'pending-received' || kind === 'pending-sent') {
    const summary = await fetchNetworkSummary(userId)
    const source =
      kind === 'pending-received' ? summary.pendingReceived : summary.pendingSent
    const items = dedupeMembers(source)
    const from = page * USER_LIST_PAGE_SIZE
    const slice = items.slice(from, from + USER_LIST_PAGE_SIZE)
    return {
      items: slice,
      totalCount: items.length,
      hasMore: from + USER_LIST_PAGE_SIZE < items.length,
      error: summary.error,
    }
  }

  if (kind === 'suggestions' || kind === 'discover') {
    const discover = await fetchDiscoverMembers(userId, USER_LIST_PAGE_SIZE, page)
    const items = dedupeMembers(discover.items)
    return {
      items,
      totalCount: items.length + page * USER_LIST_PAGE_SIZE,
      hasMore: discover.hasMore,
      error: discover.error,
    }
  }

  return { items: [], totalCount: 0, hasMore: false, error: 'Unknown list kind' }
}

export const USER_LIST_META: Record<
  UserListKind,
  { title: string; empty: string; description: string }
> = {
  connections: {
    title: 'Connections',
    empty: 'No connections yet.',
    description: `Members connected on ${BRAND_NAME}.`,
  },
  followers: {
    title: 'Followers',
    empty: 'No followers yet.',
    description: 'Members who follow this profile.',
  },
  following: {
    title: 'Following',
    empty: 'Not following anyone yet.',
    description: 'Members this profile follows.',
  },
  'pending-received': {
    title: 'Invitations',
    empty: 'No pending invitations.',
    description: 'Connection requests waiting for your response.',
  },
  'pending-sent': {
    title: 'Sent invitations',
    empty: 'No sent invitations.',
    description: 'Connection requests you have sent.',
  },
  suggestions: {
    title: 'Network suggestions',
    empty: 'No suggestions right now.',
    description: 'Suggested members to connect with.',
  },
  discover: {
    title: 'Discover network',
    empty: 'No members to show.',
    description: `Explore the ${BRAND_NAME} community.`,
  },
}
