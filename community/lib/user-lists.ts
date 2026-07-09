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

async function fetchProfilesByIds(ids: string[]): Promise<UserListMember[]> {
  if (!ids.length) return []

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, username, headline, avatar_url, location, industry, is_verified')
    .in('id', ids)
    .eq('is_deleted', false)

  if (error || !data) return []

  const byId = new Map((data as ProfileRow[]).map((row) => [row.id, row]))
  return ids
    .map((id) => {
      const row = byId.get(id)
      return row ? mapProfile(row) : null
    })
    .filter((item): item is UserListMember => !!item)
}

export async function fetchUserFollowers(
  userId: string,
  page = 0,
  pageSize = USER_LIST_PAGE_SIZE,
): Promise<{ items: UserListMember[]; hasMore: boolean; error: string | null }> {
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
    return { items: [], hasMore: false, error: error.message }
  }

  const ids = (data ?? []).map((row) => row.follower_id)
  const items = await fetchProfilesByIds(ids)
  const total = count ?? 0

  return {
    items,
    hasMore: total ? to + 1 < total : items.length === pageSize,
    error: null,
  }
}

export async function fetchUserFollowing(
  userId: string,
  page = 0,
  pageSize = USER_LIST_PAGE_SIZE,
): Promise<{ items: UserListMember[]; hasMore: boolean; error: string | null }> {
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
    return { items: [], hasMore: false, error: error.message }
  }

  const ids = (data ?? []).map((row) => row.following_id)
  const items = await fetchProfilesByIds(ids)
  const total = count ?? 0

  return {
    items,
    hasMore: total ? to + 1 < total : items.length === pageSize,
    error: null,
  }
}

export async function fetchUserListByKind(
  kind: UserListKind,
  userId: string,
  page = 0,
): Promise<{ items: UserListMember[]; hasMore: boolean; error: string | null }> {
  if (kind === 'followers') {
    return fetchUserFollowers(userId, page)
  }

  if (kind === 'following') {
    return fetchUserFollowing(userId, page)
  }

  const summary = await fetchNetworkSummary(userId)

  if (kind === 'connections') {
    return { items: summary.connections, hasMore: false, error: summary.error }
  }

  if (kind === 'pending-received') {
    return { items: summary.pendingReceived, hasMore: false, error: summary.error }
  }

  if (kind === 'pending-sent') {
    return { items: summary.pendingSent, hasMore: false, error: summary.error }
  }

  if (kind === 'suggestions') {
    return { items: summary.suggestions, hasMore: false, error: summary.error }
  }

  const discover = await fetchDiscoverMembers(userId, USER_LIST_PAGE_SIZE)
  return { items: discover.items, hasMore: false, error: discover.error }
}

export const USER_LIST_META: Record<
  UserListKind,
  { title: string; empty: string; description: string }
> = {
  connections: {
    title: 'Connections',
    empty: 'No connections yet.',
    description: `Members you are connected with on ${BRAND_NAME}.`,
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
